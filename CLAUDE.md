# CLAUDE.md

This is the single guide for Claude Code (claude.ai/code) and other AI agents working in this repository. Read it before changing the plugin — it documents the current design and the boundaries new code should respect.

## What this plugin does

OmniChat is a desktop-only Obsidian plugin that embeds AI chat websites in a sidebar using an Electron `<webview>`. It has built-in support for ChatGPT, Claude, DeepSeek, Perplexity, Gemini, Grok, Copilot, Manus AI, and Kimi, supports custom AI URLs, injects selected text and vault notes as context, and saves AI output back into the vault. No backend — fully local and session-based.

## Tech stack

| Concern | Choice |
|---|---|
| Plugin framework | Obsidian Plugin API |
| UI | Imperative DOM in `ItemView` |
| Language | TypeScript (strict mode) |
| Build | esbuild |
| Tests | Vitest (Obsidian API mocked) |
| Linting | ESLint with `typescript-eslint` and `eslint-plugin-obsidianmd` |

## Commands

```bash
npm run dev        # Watch build (esbuild)
npm run build      # Type-check then produce production bundle
npm run lint       # ESLint
npm run test       # Vitest unit tests (single run)
npm run test:watch # Vitest in watch mode
npm run version    # Bump manifest.json and versions.json from package.json
```

Build output is `main.js` in the repo root (alongside `manifest.json` and `styles.css`). Node 22+ required.
Run a single test file: `npx vitest run src/path/to/file.test.ts`.

## Module layout

```text
src/
  main.ts              Plugin entry point — lifecycle, view/command registration, settings load/save (with migration)
  settings.ts          DockSettings interface, DEFAULT_SETTINGS, AIChatSettingTab
  constants.ts         URL constants + the SERVICE_META registry (single source of truth);
                       SERVICE_URLS, ServiceKey, and ServiceEnableKey are derived from it
  utils.ts             URL normalization, service detection (getServiceKey), context building, frontmatter stripping
  commands/index.ts    registerCommands() only — keep handlers thin, delegate to main.ts methods
  views/
    AIChatView.ts      ItemView owning the webview, toolbar, service selector, context list,
                       prompt templates, split-panel behavior, and save actions
  modals/
    ContextSearchModal.ts    Search notes by name or content (add to context)
    FilePickerModal.ts       Fuzzy note picker (used by SaveDestinationModal's "append to existing")
    FolderPickerModal.ts     Folder picker (add a folder to context)
    SaveDestinationModal.ts  Save AI output as a new note or append to an existing one
```

## Data flow

```text
Switch service
  → AIChatView resolves URL → webview.src updates
  → plugin persists the URL for the main or split panel

Add context
  → AIChatView mutates items → plugin.setContextItems(items) → saveData()
  → plugin.rerenderOpenViews() so every open panel re-syncs from settings

Click Add
  → handleAddContext() reads notes with app.vault.read()
  → clipboard write always happens as the reliable fallback
  → webview.executeJavaScript(...) attempts best-effort injection
  → Notice reports the result

Click Save
  → clipboard text is captured → SaveDestinationModal writes a new note or appends to one
```

## Key design constraints

- **Webview is imperative.** The Electron `<webview>` is created and managed imperatively in `AIChatView`. Do not move it to declarative rendering.
- **Injection is best-effort.** `webview.executeJavaScript()` targets third-party chat DOMs that can change; the clipboard write is the mandatory fallback.
- **Persistence lives in `DockSettings`.** Context items, service toggles, templates, custom services, and save-folder preferences are stored via `plugin.saveData()`. Context items are the single source of truth — views re-sync from settings on render so split panels stay consistent.
- **Desktop only.** Do not add mobile compatibility layers.
- **No backend.** Local and session-based; do not add a remote service or server dependency.
- **No `innerHTML`.** Build DOM imperatively with `createEl` / `createElement`.
- **Avoid** bundled credentials or API keys, and any file access outside `app.vault`.

## Adding a new built-in AI service

Built-in services are defined once in `SERVICE_META` (`src/constants.ts`); the URL map, service selector, status bar, cycle command, per-service openers/commands, and host→key detection are all derived from it.

1. Add a row to `SERVICE_META` in `src/constants.ts` (`key`, `label`, `url`, `hosts`, `enableKey`).
2. Add the `enable<Service>` flag to the `ServiceEnableKey` union (`src/constants.ts`) and to `DockSettings` + `DEFAULT_SETTINGS` in `src/settings.ts`.
3. Add the `.vc-svc-dot--<key>` color rule in `styles.css`.

## Adding a new setting

1. Add the field to `DockSettings` in `settings.ts`.
2. Add a default in `DEFAULT_SETTINGS`.
3. Wire the control in `AIChatSettingTab.display()`.

## Adding a new command

1. Add the command in `src/commands/index.ts`.
2. Add the handler method in `src/main.ts`.

## Testing

Tests live alongside source files as `*.test.ts`. The Obsidian API is stubbed via `__mocks__/obsidian.ts` — the alias is configured in `vitest.config.ts`.

## Releasing

1. Update version in `package.json`.
2. `npm run version` — updates `manifest.json` and `versions.json`.
3. `npm run build`.
4. Commit, tag, push, create a GitHub release attaching `main.js`, `manifest.json`, and `styles.css`.
