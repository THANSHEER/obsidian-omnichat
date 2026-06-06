# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

To run a single test file: `npx vitest run src/path/to/file.test.ts`

## Architecture

OmniChat is an Obsidian desktop plugin that embeds AI chat websites (ChatGPT, Claude, Gemini, etc.) in a sidebar using an Electron `<webview>`. It injects vault notes as context and can save AI output back to the vault. No backend — fully local.

### Module layout

```
src/
  main.ts              Plugin entry point — lifecycle, view/command registration, settings I/O
  settings.ts          DockSettings interface, DEFAULT_SETTINGS, AIChatSettingTab
  constants.ts         Built-in service URL constants and SERVICE_URLS map
  utils.ts             URL normalization, service detection, context building, frontmatter stripping
  commands/index.ts    registerCommands() only — keep handlers thin, delegate to main.ts methods
  views/
    AIChatView.ts      ItemView owning the webview, toolbar, service selector, context list, save actions
  modals/
    ContextSearchModal.ts   Note search by name/content
    FolderPickerModal.ts    Folder picker for context
    SaveDestinationModal.ts Write AI output as a vault note
```

### Key design constraints

- **Webview is imperative.** The Electron `<webview>` is created and managed imperatively in `AIChatView`. Do not move it to declarative rendering.
- **Injection is best-effort.** `webview.executeJavaScript()` targets third-party chat DOMs that can change. Clipboard write always happens first as the reliable fallback.
- **All persistence lives in `DockSettings`.** Context items, service toggles, templates, custom services, and save-folder preferences are stored via `plugin.saveData()`.
- **Desktop only.** Do not add mobile compatibility layers.
- **No `innerHTML`.** Build DOM imperatively with `createEl` / `createElement`.

### Adding a new built-in AI service

1. Add the URL constant and extend `SERVICE_URLS` in `src/constants.ts`.
2. Update `getServiceKey()` in `src/utils.ts`.
3. Add the selector option in `populateServiceOptions()` in `src/views/AIChatView.ts`.
4. Add the enable toggle in `src/settings.ts` (`DockSettings` + `DEFAULT_SETTINGS` + `AIChatSettingTab`).
5. Add the opener method in `src/main.ts` and the command in `src/commands/index.ts`.
6. Add the service color rule in `styles.css`.

### Adding a new setting

1. Add the field to `DockSettings` in `settings.ts`.
2. Add a default in `DEFAULT_SETTINGS`.
3. Wire the control in `AIChatSettingTab.display()`.

### Adding a new command

1. Add the command in `src/commands/index.ts`.
2. Add the handler method in `src/main.ts`.

## Testing

Tests live alongside source files as `*.test.ts`. The Obsidian API is stubbed via `__mocks__/obsidian.ts` — the alias is configured in `vitest.config.ts`.

## Releasing

1. Update version in `package.json`.
2. `npm run version` — updates `manifest.json` and `versions.json`.
3. `npm run build`.
4. Commit, tag, push, create a GitHub release attaching `main.js`, `manifest.json`, and `styles.css`.
