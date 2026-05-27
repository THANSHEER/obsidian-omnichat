# Development Guide

This guide covers local setup, build commands, testing, and release workflow for OmniChat.

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Node.js | 22 | Build tooling |
| npm | 9 | Package management |
| Git | any | Version control |
| Obsidian desktop | 1.7.2 | Plugin host |

## Initial setup

```bash
git clone https://github.com/THANSHEER/AI-Browser-Chat
cd AI-Browser-Chat
npm install
```

No API keys, backend services, or environment variables are required.

## Build commands

| Command | What it does |
|---|---|
| `npm run dev` | Watch build with esbuild |
| `npm run build` | Type-check and produce the production bundle |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit tests |
| `npm run version` | Update `manifest.json` and `versions.json` from `package.json` |

Build output is written to the repo root as `main.js`, alongside `manifest.json` and `styles.css`.

## Link into a vault

```bash
# macOS / Linux
ln -s "$(pwd)" "/Users/<you>/path-to-vault/.obsidian/plugins/aibrowser-chat"

# Windows (Administrator Command Prompt)
mklink /D "%APPDATA%\\obsidian\\plugins\\aibrowser-chat" "%cd%"
```

Then:

1. Open Obsidian.
2. Go to **Settings → Community plugins → Installed plugins**.
3. Enable **OmniChat**.
4. Reload Obsidian after code changes with `Ctrl+R` in developer tools, or disable and re-enable the plugin.

## Project layout

```text
src/
  main.ts                    Plugin lifecycle, view registration, commands, settings
  settings.ts                Persisted settings and settings tab UI
  constants.ts               Built-in AI service URL constants
  utils.ts                   Shared helpers
  commands/index.ts          Command palette registrations
  modals/
    ContextSearchModal.ts    Search notes by name and content
    FolderPickerModal.ts     Pick folders for context
    SaveDestinationModal.ts  Save AI output into the vault
  views/
    AIChatView.ts            Imperative ItemView for webview and toolbar UI
styles.css                   Plugin styling
manifest.json                Obsidian plugin metadata
esbuild.config.mjs           esbuild bundle configuration
tsconfig.json                TypeScript strict config
eslint.config.mts            ESLint configuration
```

## Debugging

### Webview inspection

Right-click inside the embedded page and use **Inspect Element** when available. You can also inspect from Obsidian's developer tools.

### Context injection failures

Injection is best-effort. Common failure cases:

- The webview has not finished loading.
- The target AI site changed its DOM structure.
- The embedded page blocks the interaction path.

Clipboard fallback is always the reliable path.

## Releasing

1. Update `package.json` version.
2. Run `npm run version`.
3. Run `npm run build`.
4. Commit, tag, and push.
5. Create a GitHub release and attach `main.js`, `manifest.json`, and `styles.css`.
