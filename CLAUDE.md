# CLAUDE.md

Guidance for working in this repository.

## Project

`vscode-forge-tools` — a VS Code extension (published as **Autodesk Platform Services**) that surfaces
APS services (OSS, Model Derivative, Data Management/Hubs, Webhooks, Design Automation, Secure Service
Accounts) as tree views, commands, and React webview panels. TypeScript, bundled with esbuild.

## Build & run

```bash
yarn install       # install dependencies
yarn build         # esbuild -> out/ (extension + webviews)
```

- Debug in VS Code with the **Launch Extension** task (opens an Extension Development Host window).
- `vscode:prepublish` runs a production build (`NODE_ENV=production`): minified, no sourcemaps.
- Requires at least one APS environment configured (`autodesk.forge.environments`); on first run the
  extension guides you through creating one.

## Architecture

The source under `src/` is organized into five layers with a strict, one-directional dependency rule.

### Layers

```
                 ┌───────────────┐     ┌───────────────┐
                 │  src/commands │     │ src/providers │      VS Code glue (thin)
                 └──────┬────────┘     └──────┬────────┘
                        │                     │
        ┌───────────────┼─────────────────────┼───────────────┐
        ▼               ▼                     ▼                ▼
  ┌───────────┐   ┌──────────────┐      ┌──────────────┐  ┌───────────┐
  │src/webviews│  │ src/services │─────▶│  src/models  │◀─│ (all      │
  └─────┬─────┘   └──────┬───────┘      └──────────────┘  │  layers)  │
        │                │                                 └───────────┘
        └────────────────┴──────────────▶ src/models
```

- **`src/models`** — Types and interfaces only. **No `vscode`. No logic.** Categorized by service
  (`oss.ts`, `model-derivative.ts`, `hubs.ts`, `design-automation.ts`, `design-automation-api.ts`,
  `secure-service-accounts.ts`, `webhooks.ts`, `authentication.ts`), plus `environment.ts`
  (`IEnvironment`, `DesignAutomationRegion`). This is the single place every other layer gets its types.
  When a non-service layer needs an `@aps_sdk/*` type, that type is **re-exported** from the matching
  `src/models/*` file (e.g. `export type { Bucket, ObjectFullDetails } from '@aps_sdk/oss';`) so that no
  layer other than `src/services` ever imports an npm SDK package directly.

- **`src/services`** — Domain logic. **No `vscode`.** This is the *only* layer allowed to import
  `@aps_sdk/*` and to use `fetch`/`fs`. Categorized by service, one `Service` class each:
  `OssService`, `ModelDerivativeService`, `HubsService`, `DesignAutomationService`,
  `SecureServiceAccountsService`, `WebhooksService`, `AuthenticationService`. Each wraps its underlying
  `@aps_sdk/*` client (or, for Design Automation, the hand-written `fetch`-based `DesignAutomationClient`)
  and exposes plain domain methods; SDK enums/values (`Access`, `PolicyKey`, `Region`, `Scopes`, `Utils`)
  stay *inside* the service. Shared infra also lives here: `aps-sdk-manager.ts`,
  `client-credentials-authentication-provider.ts`, `static-token-authentication-provider.ts`, and the
  `createServices()` factory in `index.ts`.

- **`src/webviews`** — React apps (`*.tsx`, each exporting `render(container, props)`), bundled
  separately for the browser. They import **only** types from `src/models` (and their own UI toolkit) —
  never `vscode`, never `@aps_sdk/*`, never a service. Communication with the extension host is via
  `postMessage`.

- **`src/commands`** — Thin `vscode` command wrappers, one registry class per service exposing
  `registerCommands(): vscode.Disposable[]`. They gather input, drive quick-picks/dialogs/progress, open
  webview panels, and call `context.<name>Service.*` for all domain work.

- **`src/providers`** — Thin `vscode.TreeDataProvider`s, one per view. They map results from
  `context.<name>Service.*` into `vscode.TreeItem`s.

#### Dependency rule

Dependencies point one way only:

- `commands`, `providers` → `services` + `models`
- `services` → `models`
- `webviews` → `models`

`src/services/**` and `src/models/**` must never `import 'vscode'`. Commands, providers, and webviews
must never `import` from `@aps_sdk/*` — types come from `src/models`, behavior from `src/services`.
These invariants are checked with:

```bash
grep -rn "from 'vscode'\|import \* as vscode" src/services src/models   # must be empty
grep -rn "@aps_sdk" src/commands src/providers src/webviews             # must be empty
```

### The context object

`activate()` (`src/extension.ts`) builds a single `IContext` (`src/common.ts`). `IContext extends
IServices` — so `context` carries every service instance (`context.ossService`,
`context.modelDerivativeService`, …) plus VS Code state (`extensionContext`, `environment`,
`previewSettings`, `threeLeggedToken`, `log`). Every provider and command receives this `context`.

Service construction happens in exactly one place — `createServices(env, threeLeggedToken?)` in
`src/services/index.ts`. Activation, environment switching (`EnvironmentCommands.switchEnvironment()`),
and login/logout (`AuthenticationCommands`) all call it again and `Object.assign` the fresh services
onto `context`, rather than mutating existing instances.

`src/common.ts` also holds the `prompt*` quick-pick helpers (which call services), `showErrorMessage`,
`withProgress`, and the `createWebViewPanel`/`createViewerWebViewPanel` factories — root-level VS Code
glue that belongs to no single service. `src/environment.ts` holds the `vscode`-dependent
`getEnvironments`/`setupNewEnvironment` config helpers (the `IEnvironment` type itself lives in
`src/models/environment.ts`).

### Authentication

Two auth modes coexist:

- **2-legged** (app client credentials) — the default, via `ClientCredentialsAuthenticationProvider`.
- **3-legged** (interactive user login) — used by the Hubs view and the Model Derivative 3-legged
  client. `AuthenticationService` runs a local HTTP callback server (default port `8123`) to complete
  the OAuth flow; `AuthenticationCommands.login()` opens the browser and stores the resulting token in
  memory as `context.threeLeggedToken`, then rebuilds the services in user context. Migrating this to a
  `vscode.AuthenticationProvider` is a planned change.

### Build

esbuild (`esbuild.js`) produces two bundles:

- **Extension** — entry `src/extension.ts` → `out/extension.js`, `platform: node`, `format: cjs`,
  `external: ['vscode']`.
- **Webviews** — every `src/webviews/*.tsx` (globbed dynamically) → `out/webviews/`, `format: esm`,
  `target: es2020`, code-split. Loaded by the panel HTML in `createWebViewPanel`.

`yarn build` runs a development build; `vscode:prepublish` runs a production build
(`NODE_ENV=production`: minified, no sourcemaps). `yarn typecheck` runs `tsc --noEmit` (type-checking
only — esbuild does all emitting). There is no separate lint/format step.

## Conventions

- **Commands and `package.json` contributes are hand-synced, not generated.** Each `*Commands` class in
  `src/commands/*.ts` has a `registerCommands(): vscode.Disposable[]` method that calls
  `vscode.commands.registerCommand(id, handler)` for every command it owns. The command IDs, titles,
  categories, icons, and menu placements are declared separately in `package.json` under
  `contributes.commands` and `contributes.menus` (`view/title`, `view/item/context`). There is no build
  step or decorator that keeps these two sides in sync — **every change on one side must be mirrored on
  the other side in the same commit**:
  - Adding/removing/renaming a command in `src/commands/*.ts` → add/remove/update the matching
    `contributes.commands` entry (same `command` ID, matching `title`, `category`, `icon`), and the
    matching `contributes.menus['view/title']` / `['view/item/context']` entry if it appears in a
    toolbar or context menu.
  - Adding/removing/editing a `contributes.commands` or `contributes.menus` entry → make sure there's a
    corresponding `vscode.commands.registerCommand(...)` call with the exact same ID in that domain's
    `registerCommands()`. A `contributes.commands` entry with no registration shows up in the Command
    Palette but fails with "command not found" when invoked; same for an orphaned menu entry.
  - Command IDs follow `<prefix>.<methodName>`, where `<prefix>` matches the other commands in that file
    (e.g. `aps.oss.*` for `object-storage.ts`, `aps.da.*` for `design-automation.ts`).
  - Don't reintroduce a decorator, codegen script, or build step to automate this sync — it was
    deliberately removed in favor of keeping both sides hand-maintained and explicit.
- **Respect the layer boundaries** (see [Architecture](#architecture) above). Dependencies point one
  way: `commands`/`providers` → `services` + `models`; `services` → `models`; `webviews` → `models`.
  `src/services/**` and `src/models/**` must never `import 'vscode'`. Only `src/services/**` may import
  `@aps_sdk/*` or use `fetch`/`fs`; commands, providers, and webviews get their types from `src/models`
  (re-export the SDK type there rather than importing the npm package directly) and their behavior from
  `context.<name>Service` methods — never call an SDK client or do API transforms in a command/provider.
- **Service construction only happens in `createServices()`** (`src/services/index.ts`). `activate()`,
  `EnvironmentCommands.switchEnvironment()`, and `AuthenticationCommands.login()`/`logout()` all just
  call it again and `Object.assign` the result onto `context` — never construct a service or SDK client
  ad hoc elsewhere.
- **New services should use the official `@aps_sdk/*` SDKs** (e.g. `@aps_sdk/secure-service-account`,
  `@aps_sdk/oss`, `@aps_sdk/model-derivative`), not the legacy `aps-sdk-node`. Reuse
  `ClientCredentialsAuthenticationProvider` and `createApsSdkManager` from `src/services/` for
  auth/host wiring instead of rolling new token-fetching code. Wrap the client in a `Service` class that
  exposes plain domain methods (SDK enums/values stay inside the service). If a service has no official
  `@aps_sdk/*` package (e.g. Design Automation), write a minimal `fetch`-based REST wrapper instead
  of pulling in an HTTP library — see `src/services/design-automation.ts`.
- No `axios` or `fs-extra` dependency — use the global `fetch`/`FormData`/`Blob` for HTTP calls and
  plain `fs` (`mkdirSync`, `writeFileSync`, etc.) for filesystem access.
- Match the surrounding code style; there is no automated formatter/linter step in the build (tslint
  was removed; `yarn typecheck` runs `tsc --noEmit` for type-checking only).
- **Every user-facing code change must add an entry to [CHANGELOG.md](CHANGELOG.md) in the same
  commit.** Add a bullet under the appropriate `Added`/`Changed`/`Removed`/`Fixed` subsection of the
  `[Unreleased]` section at the top of the file (create the subsection if it doesn't exist yet); don't
  create a new version heading yourself — that happens at release time. Purely internal changes with no
  observable effect on the extension's behavior (e.g. comments, test-only changes) don't need an entry.
