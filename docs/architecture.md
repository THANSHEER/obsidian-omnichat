# Architecture

This document explains how OmniChat is structured and how the main data flows work.

## What the plugin does

OmniChat embeds AI chat services in an Obsidian sidebar using an Electron `<webview>`. It includes built-in support for ChatGPT, Claude, DeepSeek, Perplexity, Gemini, Grok, Copilot, Manus AI, and Kimi, and it can also expose custom AI URLs in the same selector. The plugin can inject selected text, send vault context, apply prompt templates, and save AI output back into the vault.

## Tech stack

| Concern | Choice |
|---|---|
| Plugin framework | Obsidian Plugin API |
| UI | Imperative DOM inside `ItemView` |
| Language | TypeScript with strict mode |
| Build | esbuild |
| Testing | Vitest |

## Module map

```text
src/
  main.ts                    Plugin lifecycle, commands, and view registration
  settings.ts                Persisted settings and settings tab
  constants.ts               Built-in service URLs
  utils.ts                   Shared helpers like URL normalization and context building
  commands/index.ts          Command registration
  views/
    AIChatView.ts            Main panel UI and webview lifecycle
  modals/
    ContextSearchModal.ts    Note search modal
    FolderPickerModal.ts     Folder picker modal
    SaveDestinationModal.ts  Save AI output into the vault
```

## Primary flows

### Switching services

1. User changes the selector.
2. `AIChatView` resolves the target URL.
3. The webview `src` updates.
4. The selected URL is persisted for the main or split panel.

### Building context

1. User adds the active note, open tabs, a searched note, or a folder.
2. `AIChatView` updates `items`.
3. `plugin.setContextItems(items)` persists the selection into plugin settings.

### Sending context

1. `handleAddContext()` reads vault files with `app.vault.read()`.
2. Content is assembled by `buildContextString()`.
3. Clipboard write happens first as the reliable fallback.
4. `executeJavaScript()` tries to paste into the active chat page.
5. A notice reports whether injection succeeded or the user should paste manually.

### Saving AI output

1. User chooses **Save selection** or **Save clipboard**.
2. The plugin reads the selection from the webview or from the clipboard.
3. `SaveDestinationModal` creates a markdown note in the configured vault folder.

## Key design decisions

### Webview is imperative

The Electron `<webview>` is created and managed imperatively inside `AIChatView`. Do not move it to declarative JSX.

### Injection is best-effort

The plugin cannot guarantee DOM selectors inside third-party AI websites will remain stable. Clipboard fallback is the reliable path.

### Persistence lives in settings

Context items, service toggles, prompt templates, custom services, theme choice, and save-folder settings are all stored in plugin data.

### No backend

This is a local browser-wrapper plugin. Do not add a remote service or server dependency.

### Desktop only

The plugin depends on Electron webviews and is intentionally desktop-only.

## Adding a new built-in AI service

1. Add the URL constant in [src/constants.ts](/Users/mohammedthansheer/Documents/Sample Notes/.obsidian/plugins/AI-Browser-Chat/src/constants.ts).
2. Extend `SERVICE_URLS`.
3. Add hostname detection in [src/utils.ts](/Users/mohammedthansheer/Documents/Sample Notes/.obsidian/plugins/AI-Browser-Chat/src/utils.ts).
4. Add the selector option in [src/views/AIChatView.ts](/Users/mohammedthansheer/Documents/Sample Notes/.obsidian/plugins/AI-Browser-Chat/src/views/AIChatView.ts).
5. Add the settings toggle in [src/settings.ts](/Users/mohammedthansheer/Documents/Sample Notes/.obsidian/plugins/AI-Browser-Chat/src/settings.ts).
6. Add the command and `open<Service>()` method in [src/commands/index.ts](/Users/mohammedthansheer/Documents/Sample Notes/.obsidian/plugins/AI-Browser-Chat/src/commands/index.ts) and [src/main.ts](/Users/mohammedthansheer/Documents/Sample Notes/.obsidian/plugins/AI-Browser-Chat/src/main.ts).
7. Add the service color rule in `styles.css`.
