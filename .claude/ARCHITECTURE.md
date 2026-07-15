# Architecture

This document describes the architecture of the **Autodesk Platform Services** VS Code extension
(`vscode-forge-tools`). It reflects the current state of the codebase on the `develop` branch.

## Overview

The extension is a client for [Autodesk Platform Services (APS)](https://aps.autodesk.com) (formerly
Forge). It surfaces several APS services inside VS Code as tree views, context-menu commands, and
webview panels:

- **Object Storage Service (OSS)** — buckets & objects (`Buckets & Derivatives` view)
- **Model Derivative** — translation, manifests, thumbnails, derivative download & preview
- **Data Management / Hubs** — browsing BIM360/ACC hubs (`Hubs & Derivatives` view, 3-legged auth)
- **Webhooks** — browse/manage webhooks (`Webhooks` view)
- **Design Automation** — app bundles, activities, aliases, work items (`Automation` view)
- **Secure Service Accounts (SSA)** — accounts and keys (`Secure Service Accounts` view)

The codebase is TypeScript, bundled with **esbuild**, and targets VS Code `^1.92.0`. The extension
host code runs in Node.js; webview UIs are React apps bundled separately as ES modules.

## Build & tooling

Defined in [esbuild.js](../esbuild.js). Two independent bundles are produced:

| Bundle | Entry | Output | Format / Platform | Notes |
|--------|-------|--------|-------------------|-------|
| Extension host | `src/extension.ts` | `out/extension.js` | CJS / node | `vscode` marked external |
| Webviews | every `src/webviews/*.tsx` | `out/webviews/*` | ESM / es2020 | code-splitting enabled |

- `package.json` → `main` points at `./out/extension.js`.
- `vscode:prepublish` runs the production build (`NODE_ENV=production` → minify, no sourcemaps).
- The webview bundles are loaded into panels from the `out/` directory via `asWebviewUri`.

### Hand-synced code: `contributes`

`package.json`'s `contributes.commands` and `contributes.menus` (commands + menus) are **not
generated** — they're maintained by hand alongside the `registerCommands()` calls in
`src/commands/*.ts`. There used to be a decorator framework and a codegen script
(`src/scripts/update-contributes.ts`, aliasing `vscode` to a `vscode-shim.js` stub so the command
modules could be imported in plain Node) that derived `contributes` from decorator metadata; both
were removed in favor of explicit registration and manual sync. See the "Commands and `package.json`
contributes are hand-synced" convention in [CLAUDE.md](CLAUDE.md) for the sync rules.

(Secure Service Accounts previously used a Kiota-generated client here too; it's now the official
`@aps_sdk/secure-service-account` npm package instead — see [API clients](#7-api-clients) below.)

## Runtime layers

```
┌───────────────────────────────────────────────────────────────────────┐
│ extension.ts  (activate)                                                │
│   builds IContext, registers auth provider, tree views, command sets,   │
│   status bar items, and the 3-legged session sync                       │
└───────────────┬───────────────────────────────┬───────────────────────┘
                │                                │
      ┌─────────▼─────────┐          ┌───────────▼─────────────┐
      │ TreeDataProviders │          │ Command registry classes│
      │ (src/providers)   │          │ (src/commands)          │
      │  render tree,     │◄────────►│  business logic; open   │
      │  call clients     │ refresh  │  webviews & prompts     │
      └─────────┬─────────┘          └───────────┬─────────────┘
                │                                │
                └────────────┬───────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │ IContext: shared service      │
              │ clients + settings + logging  │
              └──────────────┬───────────────┘
                             ▼
        ┌──────────────────────────────────────────────┐
        │ API clients (all built by createClients())   │
        │  • aps-sdk-node (OSS, MD, DA, Webhooks,      │
        │    BIM360, Authentication)                   │
        │  • @aps_sdk/secure-service-account, backed   │
        │    by a reusable ClientCredentialsAuth-      │
        │    enticationProvider (@aps_sdk/* family)    │
        └──────────────────────────────────────────────┘

  Webview panels (React, @vscode/webview-ui-toolkit) rendered via
  createWebViewPanel / createViewerWebViewPanel and driven by postMessage.
```

### 1. Activation & the shared context (`IContext`)

[src/extension.ts](../src/extension.ts) `activate()` is the composition root:

1. Reads configured environments via `getEnvironments()`. If none exist, it launches the guided
   `setupNewEnvironment()` flow and returns early.
2. Uses the **first** environment as the active one and builds a single `IContext`
   ([src/common.ts](../src/common.ts)) — the dependency-injection container passed to every provider
   and command. `IContext extends IClients` (see [src/clients/index.ts](../src/clients/index.ts)) plus:
   - the active `environment`;
   - `previewSettings` (viewer extensions/env/api pulled from configuration);
   - a `LogOutputChannel` (`log`);
   - `threeLeggedToken?` — the current user access token when logged in (drives the 3-legged flow).

   `IClients` is produced by **`createClients(env, threeLeggedToken?)`**
   ([src/clients/index.ts](../src/clients/index.ts)) — the single factory that builds every API
   client (`credentials`, `authenticationClient`, `dataManagementClient`, `modelDerivativeClient2L`,
   `modelDerivativeClient3L`, `designAutomationClient`, `webhookClient`, `bim360Client`,
   `secureServiceAccountsClient`) from an environment. Activation calls it once; switching
   environments ([src/commands/environment.ts](../src/commands/environment.ts)) and logging in/out
   ([src/commands/authentication.ts](../src/commands/authentication.ts)) call it again and
   `Object.assign` the result onto the existing `context`, so there is exactly one place client
   construction happens.

   Note there are **two** Model Derivative clients: `modelDerivativeClient2L` (2-legged / app
   credentials) and `modelDerivativeClient3L` (3-legged / user token), reflecting the two auth modes.

3. Creates the five tree views and their data providers.
4. Instantiates each command registry, passing `context` and a `refresh` callback that re-renders the
   relevant tree view(s). `registerCommands()` returns disposables pushed into
   `extensionContext.subscriptions`.
5. Creates two status bar items: **environment** (`APS Env: <title>` → `aps.switchEnvironment`) and
   **auth** (`APS Auth: 2-legged | 3-legged`, toggling login/logout based on `threeLeggedToken`).

`activationEvents` is empty; activation is driven by the contributed views/commands.

### 2. Configuration & environments

[src/environment.ts](../src/environment.ts) defines `IEnvironment` and reads
`autodesk.forge.environments` from configuration (using `getConfiguration(undefined, null)` so
resource-scoped settings resolve globally). It includes backward-compat handling for the old
single-app `clientId`/`clientSecret` settings and a guided `setupNewEnvironment()` wizard that writes
a new environment and reloads the window. Switching environments is handled by
`EnvironmentCommands`; the README notes the extension always initializes from the first environment
in the list and that Workspace scope takes precedence over User scope.

Other relevant settings (declared in `package.json` `contributes.configuration`):
`autodesk.forge.viewer.extensions|env|api`, `autodesk.forge.data.defaultContentType`,
`autodesk.forge.data.uploadChunkSize`.

### 3. Authentication

Two distinct authentication paths coexist:

**2-legged (app credentials)** — the default. `aps-sdk-node` clients are constructed directly with
`{ client_id, client_secret }` and manage their own token fetching internally. The
`@aps_sdk/secure-service-account` client instead takes an `IAuthenticationProvider`; that role is
filled by
[ClientCredentialsAuthenticationProvider](../src/clients/client-credentials-authentication-provider.ts),
which calls `@aps_sdk/authentication`'s `AuthenticationClient.getTwoLeggedToken(...)` per request.
It's deliberately generic (clientId/secret/scopes/host, not SSA-specific) so future `@aps_sdk/*`
clients can reuse it instead of each rolling their own token acquisition.

**3-legged (user login)** — used by the Hubs view and `modelDerivativeClient3L`. Implemented in
[src/commands/authentication.ts](../src/commands/authentication.ts) with a **local HTTP callback
server**, not a `vscode.AuthenticationProvider`:

- `login()` starts an `http.createServer` on a configurable port (`autodesk.forge.authentication.port`,
  default `8123`), opens `http://localhost:<port>` in the browser, and serves a Bootstrap login page.
- The page instructs the user to register `http://localhost:<port>/auth/callback` as a redirect URI on
  their APS app, then redirects to the APS `/authentication/v2/authorize` endpoint (authorization-code
  flow). The `/auth/callback` route exchanges the code via `authenticationClient.getToken(...)` and
  resolves the token (2-minute timeout).
- On success, `context.threeLeggedToken` is set and the token is injected into `bim360Client` and
  `modelDerivativeClient3L` via `reset({ token })`, with `delete (client as any).auth` / `.token`
  workarounds for the `aps-sdk-node` auth shape. `logout()` reverses this back to 2-legged credentials.
- `DefaultScopes` (a fixed list) is defined in the same file. `getAccessToken()` generates a 2-legged
  token for user-selected scopes and copies it to the clipboard.

> There is **no** `vscode.AuthenticationProvider`, `secrets` storage, or token refresh yet — the
> 3-legged token lives only in memory (`context.threeLeggedToken`) for the lifetime of the token.
> Migrating to the official provider API is a planned change (see the notes below).

### 4. Tree views (`src/providers`)

Each view is a `vscode.TreeDataProvider<T>` where `T` is a union of the node types for that view.
They follow a consistent pattern (see [src/providers/data-management.ts](../src/providers/data-management.ts)
as the reference):

- A private `_onDidChangeTreeData` `EventEmitter` and a public `refresh(entry?)` method (fired by
  command `refresh` callbacks after mutations).
- Type-guard functions (`isBucket`, `isObject`, `isDerivative`, `isHint`, …) to discriminate the
  union and render the right `TreeItem`.
- `contextValue` on each `TreeItem` drives the `when` clauses of context-menu commands in
  `package.json` (e.g. `viewItem == bucket`, `viewItem == derivative`).
- `getChildren` lazily calls the relevant client. The OSS provider, for example, lists buckets at the
  root, objects under a bucket, and derivatives under an object — polling the Model Derivative
  manifest and auto-refreshing every second while a translation is `inprogress`, or rendering a
  "hint" node on failure/absence.

Providers: `SimpleStorageDataProvider` (OSS + derivatives), `HubsDataProvider` (3-legged hubs),
`WebhooksDataProvider`, `DesignAutomationDataProvider`, `SecureServiceAccountsDataProvider`.
[src/providers/model-derivative.ts](../src/providers/model-derivative.ts) provides shared
`ModelDerivativeFormats` helpers (viewable vs non-viewable output detection) used by multiple
providers/commands.

### 5. Commands (`src/commands`)

Commands are grouped into plain registry classes, one per service, each constructed with
`(context, refresh)`. Every class implements its own `registerCommands(): vscode.Disposable[]` method
that lists explicit `vscode.commands.registerCommand('<id>', this.method.bind(this))` calls — one per
command — and returns the resulting disposables. Command IDs follow `<prefix>.<methodName>`
(e.g. `aps.dm.copyHubID`), matching the prefix convention used by the other commands in that file.

There's no decorator or base class deriving these registrations or the `package.json` `contributes`
entries — the two are hand-synced (see [CLAUDE.md](CLAUDE.md)). A class earlier had a
`CommandRegistry` base with `@CommandCategory`/`@Command`/`@ViewTitleMenu`/`@ViewItemContextMenu`
decorators that generated both the runtime registration and the `contributes` entries from shared
metadata; it was removed in favor of the explicit, hand-maintained approach above.

The registries (constructed with `(context, refresh)`): `EnvironmentCommands`,
`AuthenticationCommands`, `ObjectStorageServiceCommands`, `DataManagementCommands`,
`ModelDerivativesCommands`, `WebhooksCommands`, `DesignAutomationCommands`,
`SecureServiceAccountsCommands`. The Model Derivative and Design Automation command files are by far
the largest (~800 and ~700 lines), holding the bulk of the business logic (translation options,
derivative downloads via `svf-utils`, work-item orchestration, etc.).

Shared helpers live in [src/common.ts](../src/common.ts): `promptBucket` / `promptObject` /
`promptDerivative` / `promptEngine` (QuickPick prompts), `showErrorMessage` (logs + optional raw
response detail view), `withProgress`, `stringPropertySorter`, and the webview factories.

### 6. Webviews (`src/webviews`)

Detail/editor panels are React apps rendered inside `vscode.WebviewPanel`s. Two factory functions in
`common.ts` create panels:

- `createWebViewPanel` — standard panel; restricts `localResourceRoots` to `out/`, uses a strict CSP
  with a per-render nonce, and injects props by `JSON.stringify` into an inline module script that
  imports the bundle's `render(container, props)` export.
- `createViewerWebViewPanel` — for the Model Derivative viewer; loads the APS Viewer JS/CSS from
  `developer.api.autodesk.com`, no `localResourceRoots` restriction, and passes props base64-encoded.

Each `*.tsx` file exports a `render(container, props)` that mounts a component with
`ReactDOM.createRoot` (see [src/webviews/bucket-details.tsx](../src/webviews/bucket-details.tsx)). UI
is built with `@vscode/webview-ui-toolkit/react` components (`VSCodeTextField`, `VSCodeDataGrid`,
…) plus shared `components/Grid.tsx` and `components/Actions.tsx`. Two-way communication uses
`postMessage`: the webview side is wrapped in [src/webviews/common.ts](../src/webviews/common.ts)
(`postMessage` over `acquireVsCodeApi()`), and the host side passes an `onMessage` callback to the
panel factory. Panels cover bucket/object/webhook/appbundle/activity/alias/SSA details, creation &
update forms, custom translation, thumbnails, and derivative preview.

### 7. API clients

- **`aps-sdk-node`** — the established SDK, used for Authentication, OSS/Data Management, Model
  Derivative (2L + 3L instances), Design Automation, Webhooks, and BIM360.
- **`svf-utils`** — used by Model Derivative commands to download/convert derivatives (SVF, F2D,
  glTF).
- **`@aps_sdk/secure-service-account`** (official Autodesk SDK, successor to `aps-sdk-node`) — used
  for Secure Service Accounts. [src/clients/secure-service-accounts.ts](../src/clients/secure-service-accounts.ts)
  builds the client with a `ClientCredentialsAuthenticationProvider` and an environment-aware
  `SdkManager` (see [src/clients/aps-sdk-manager.ts](../src/clients/aps-sdk-manager.ts), which points
  the SDK at `env.host` instead of always assuming the production APS host). JWT assertion signing
  and exchange (`aps.ssa.generateAssertion` / `generateAccessToken`) use the SDK's own
  `Utils.generateJwtAssertion` and `SecureServiceAccountClient.exchangeJwtAssertion` rather than
  hand-rolled JWT/fetch code. This `@aps_sdk/*` family (also used transitively by `svf-utils` for
  Model Derivative) is the intended pattern for future service clients, not `aps-sdk-node`.
- **No client mutates itself in place.** Every client, from every family, is rebuilt fresh by
  `createClients()` whenever the environment or auth mode changes — see the note in
  [Activation](#1-activation--the-shared-context-icontext) above.

## Directory map

| Path | Responsibility |
|------|----------------|
| `src/extension.ts` | Activation / composition root, context, status bar, session sync |
| `src/common.ts` | `IContext`, shared prompts/helpers, webview panel factories |
| `src/environment.ts` | Environment config model, discovery, setup wizard |
| `src/providers/` | `TreeDataProvider`s (one per view) |
| `src/commands/` | Command registries, one per service, each with a `registerCommands()` method |
| `src/webviews/` | React webview apps + shared components |
| `src/clients/` | `createClients()` factory (all API clients) + `@aps_sdk/*` auth provider/SDK-manager helpers + SSA client factory |
| `src/interfaces/` | Shared TypeScript interfaces per service |
| `esbuild.js` | Build config (extension host + webviews) |

## Notable design points & caveats

- **Single active environment.** The extension only ever instantiates clients for
  `environments[0]`; switching environments recreates/refreshes state rather than holding multiple
  live contexts.
- **Two coexisting client styles.** Most services use the legacy `aps-sdk-node`; SSA uses the
  official `@aps_sdk/*` family. New services are expected to follow the `@aps_sdk/*` pattern (see
  [API clients](#7-api-clients)), reusing `ClientCredentialsAuthenticationProvider` and
  `createApsSdkManager` rather than each adding their own token/host handling.
- **Hand-synced `contributes`.** Command/menu declarations in `package.json` and the
  `registerCommands()` calls in `src/commands/*.ts` are two independent, hand-maintained sources of
  truth — every command addition/removal/rename must be updated in both places (see [CLAUDE.md](CLAUDE.md)).
- **Derivative region assumption.** Code assumes derivatives live in the same region as the source
  object; cross-region derivatives can produce `406` errors (see README "Known Limitations").
- **Ad-hoc 3-legged auth.** Login runs a local HTTP server and requires the user to manually add a
  `localhost` redirect URI to their APS app; the token is held only in memory with no refresh.
  Migrating to a `vscode.AuthenticationProvider` is a planned change (this would replace `login()`'s
  local server and add `secrets`-backed persistence + refresh, but wouldn't need to touch
  `createClients()` itself — it would just call it with the refreshed token like `login()`/`logout()`
  do today).
</content>
