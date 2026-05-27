# AGENTS.md — OmniChat Architecture Guide

Read this before changing the plugin. It documents the current design and the boundaries new code should respect.

## What this plugin does

OmniChat embeds AI chat websites in an Obsidian sidebar using an Electron `<webview>`. It includes built-in support for ChatGPT, Claude, DeepSeek, Perplexity, Gemini, Grok, Copilot, Manus AI, and Kimi, supports custom AI URLs, can inject selected text and vault context, and can save AI output back into the vault.

## Tech stack

| Concern | Choice |
|---|---|
| Plugin framework | Obsidian Plugin API |
| UI | Imperative DOM in `ItemView` |
| Language | TypeScript with strict mode |
| Build | esbuild |
| Linting | ESLint with `typescript-eslint` and `eslint-plugin-obsidianmd` |

## Repository layout

```text
src/
  main.ts                    Plugin entry point. Owns lifecycle, command registration,
                             settings load/save, and view registration.

  settings.ts                DockSettings, DEFAULT_SETTINGS, and AIChatSettingTab.
                             Persisted state belongs here.

  constants.ts               Built-in AI service URLs.

  utils.ts                   Shared helpers like URL normalization, service detection,
                             context construction, and frontmatter stripping.

  commands/
    index.ts                 registerCommands() only. Keep command handlers thin.

  views/
    AIChatView.ts            Main ItemView implementation. Owns the webview lifecycle,
                             toolbar, service selector, context list, templates,
                             split-panel behavior, and save actions.

  modals/
    ContextSearchModal.ts    Search notes by name or content.
    FolderPickerModal.ts     Pick folders for context.
    SaveDestinationModal.ts  Save AI output into the vault.
```

## Data flow

```text
User switches service
  → AIChatView resolves URL
  → webview.src updates
  → plugin persists URL for main or split panel

User adds context
  → AIChatView updates items
  → plugin.setContextItems(items)
  → saveData()

User clicks Add
  → handleAddContext() reads notes with app.vault.read()
  → clipboard write always happens as fallback
  → webview.executeJavaScript(...) tries best-effort injection
  → Notice reports the result

User clicks Save
  → selection or clipboard text is captured
  → SaveDestinationModal writes a markdown note
```

## Key design decisions

**Webview is imperative.** Do not try to render Electron `<webview>` declaratively.

**Injection is best-effort.** Clipboard fallback is mandatory because third-party chat DOMs can change.

**Persistence belongs in settings.** Context items, service toggles, templates, custom services, and save-folder preferences should remain in `DockSettings`.

**No backend.** This plugin is local-only and session-based.

**Desktop only.** Do not add mobile compatibility shims.

## Adding a new setting

1. Add the field to `DockSettings` in `settings.ts`.
2. Add a default in `DEFAULT_SETTINGS`.
3. Wire the control in `AIChatSettingTab.display()`.

## Adding a new command

1. Add the command in `src/commands/index.ts`.
2. Add the handler method in `src/main.ts`.

## Adding a new built-in AI service

1. Add the URL constant in `src/constants.ts`.
2. Extend `SERVICE_URLS`.
3. Update `getServiceKey()` in `src/utils.ts`.
4. Add the selector option in `populateServiceOptions()` inside `src/views/AIChatView.ts`.
5. Add the enable toggle in `src/settings.ts`.
6. Add the opener method in `src/main.ts`.
7. Add the command entry in `src/commands/index.ts`.
8. Add the service color rule in `styles.css`.

## Build

```bash
npm run dev
npm run build
```

Build output is `main.js` in the repo root.

## Avoid

- Bundled credentials or API keys
- File access outside `app.vault`
- Backends or server dependencies
- `innerHTML`
- Mobile compatibility layers
