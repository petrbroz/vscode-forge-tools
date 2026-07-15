# CLAUDE.md

Guidance for working in this repository.

## Project

`vscode-forge-tools` — a VS Code extension (published as **Autodesk Platform Services**) that surfaces
APS services (OSS, Model Derivative, Data Management/Hubs, Webhooks, Design Automation, Secure Service
Accounts) as tree views, commands, and React webview panels. TypeScript, bundled with esbuild.

For a full architecture overview, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Build & run

```bash
yarn install       # install dependencies
yarn build         # esbuild -> out/ (extension + webviews)
```

- Debug in VS Code with the **Launch Extension** task (opens an Extension Development Host window).
- `vscode:prepublish` runs a production build (`NODE_ENV=production`): minified, no sourcemaps.
- Requires at least one APS environment configured (`autodesk.forge.environments`); on first run the
  extension guides you through creating one.

## Layout

- `src/extension.ts` — activation / composition root; builds the shared `IContext`.
- `src/common.ts` — `IContext`, shared prompts/helpers, webview panel factories.
- `src/providers/` — one `TreeDataProvider` per view.
- `src/commands/` — command registries, one per service; each exposes a `registerCommands()` method.
- `src/webviews/` — React webview apps (`*.tsx`, each exports `render(container, props)`).
- `src/clients/` — `createClients(env, threeLeggedToken?)`, the single factory that builds every API
  client; a `ClientCredentialsAuthenticationProvider` + `createApsSdkManager` for the `@aps_sdk/*`
  family; and the Secure Service Accounts client factory.
- 3-legged OAuth login lives in `src/commands/authentication.ts` (local HTTP callback server on port
  `8123` by default; token kept in memory as `context.threeLeggedToken`). Migrating this to a
  `vscode.AuthenticationProvider` is a planned change.

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
- **Client construction only happens in `createClients()`** (`src/clients/index.ts`). `activate()`,
  `EnvironmentCommands.switchEnvironment()`, and `AuthenticationCommands.login()`/`logout()` all just
  call it again and `Object.assign` the result onto `context` — never call `.reset()` on a client or
  construct one ad hoc elsewhere.
- **New service clients should use the official `@aps_sdk/*` SDKs** (e.g. `@aps_sdk/secure-service-account`,
  `@aps_sdk/oss`, `@aps_sdk/model-derivative`), not the legacy `aps-sdk-node`. Reuse
  `ClientCredentialsAuthenticationProvider` and `createApsSdkManager` from `src/clients/` for
  auth/host wiring instead of rolling new token-fetching code.
- Two auth modes coexist: 2-legged (app credentials, default) and 3-legged (user login, used by the
  Hubs view and `modelDerivativeClient3L`).
- Match the surrounding code style; there is no automated formatter/linter step in the build.
