# CLAUDE.md — AI Chat Architecture Guide

This file is the AI contributor guide. Read it before suggesting changes. It describes the design intent and boundaries so new code fits the existing architecture.

## What this plugin does

AI Chat embeds AI chat services (ChatGPT, Claude, DeepSeek, Perplexity, Gemini, Grok) in an Obsidian sidebar using an Electron `<webview>`. It also provides a vault context feature: the user selects notes or folders, clicks **Add**, and the note content is injected into the AI chat input (or copied to the clipboard if injection is unavailable).

## Tech stack

| Concern | Choice |
|---|---|
| Plugin framework | Obsidian Plugin API (`obsidian` npm package) |
| UI | React 18 (JSX transform, no class components) |
| Language | TypeScript with strict mode enabled |
| Build | esbuild (see `esbuild.config.mjs`) |
| Linting | ESLint with `typescript-eslint` and `eslint-plugin-obsidianmd` |

## Repository layout

```
src/
  main.ts                    Plugin entry point. Owns lifecycle, settings load/save,
                             view registration, ribbon, and command registration.
                             All other files are imported from here.

  settings.ts                DockSettings interface, DEFAULT_SETTINGS, and
                             AI ChatSettingTab (Obsidian PluginSettingTab).
                             Add new persisted options here — never store state
                             outside of DockSettings. Now includes `contextItems`
                             for persistent memory.

  constants.ts               URL constants for all six AI services.

  commands/
    index.ts                 registerCommands() — wires command palette entries
                             to methods on AI ChatPlugin. Keep thin; logic
                             stays in main.ts.

  views/
    AI ChatView.tsx       Obsidian ItemView that mounts the React tree.
                             AI ChatView.renderView() is the single call site
                             that renders <AI ChatPanel>. Pass new props here
                             when adding plugin-level state to the React layer.

  components/
    AI ChatPanel.tsx      Root React component. Owns the <webview> lifecycle
                             (create, src updates, event listeners, teardown)
                             and the context injection logic. Now includes a
                             unified header for service selection and context
                             management.

  modals/
    FilePickerModal.ts       FuzzySuggestModal<TFile> — picks a single note.
    FolderPickerModal.ts     FuzzySuggestModal<TFolder> — picks a folder.
                             Both are Obsidian class-based; instantiate them
                             with `new XModal(app, callback).open()`.
```

## Data flow

```
User picks a service from the dropdown
  → onChange fires → switchService(key) → setActiveUrl → webview.src updated

User adds context (Active / + Open / + Note / + Folder buttons)
  → AI ChatPanel adds to 'items' state
  → useEffect fires → onContextItemsChange(items) → plugin.setContextItems → saveData

User clicks "Add"
  → handleSendContext() reads vault content via app.vault.read()
  → navigator.clipboard.writeText(context)   ← always runs
  → webview.executeJavaScript(injectScript)  ← best-effort
  → new Notice(…)
```

## Key design decisions

**Webview is created imperatively, not declaratively.** React cannot render Electron's `<webview>` tag reliably; the element is appended to a `div` ref inside a `useEffect` and removed on cleanup. Do not attempt to render `<webview>` inside JSX.

**Context injection is best-effort.** `executeJavaScript` may fail if the webview hasn't loaded, the site changed its DOM, or the Electron IPC is not ready. The clipboard copy is always the reliable fallback. Do not assume injection succeeds.

**Context persistence is handled via settings.** Selected files and folders are saved to `DockSettings.contextItems` whenever they change, ensuring "memory" across service switches and Obsidian restarts.

**No global state / no stores.** State flows down via props and up via callbacks. Do not introduce a context provider or state library — the component tree is shallow enough that prop drilling is fine.

**Modals are class-based, not hooks.** Obsidian modals extend `FuzzySuggestModal` or `Modal`. Instantiate them inside event handlers; do not try to render them as React components.

**Desktop-only, no mobile.** `manifest.json` sets `"isDesktopOnly": true`. The `<webview>` Electron API does not exist on mobile. Do not add mobile fallbacks or compatibility shims.

## Adding a new setting

1. Add the field to `DockSettings` in `settings.ts` with a default in `DEFAULT_SETTINGS`.
2. Add a `new Setting(containerEl)…` block in `AI ChatSettingTab.display()`.

## Adding a new command

Add an entry to `registerCommands()` in `commands/index.ts` and a corresponding method on `AI ChatPlugin` in `main.ts`.

## Adding a new AI service

1. Add a URL constant in `constants.ts`.
2. Add an entry to `SERVICE_URLS` in `AI ChatPanel.tsx` (the `as const` object).
3. Add a `getServiceKey` case for the new domain (URL pattern match).
4. Add an `<option value="newkey">Service Name</option>` inside the `<select>` in `AI ChatPanel.tsx`.
5. Add a `vc-svc-dot--newkey` rule in `styles.css` with the service's brand colour.
6. Add `enableNewService` to `DockSettings` and `DEFAULT_SETTINGS` in `settings.ts`, wire the toggle in the settings tab, and pass the prop from `AI ChatView.renderView()`.
7. Add `openNewService()` in `main.ts` and a command in `commands/index.ts`.

## Build

```bash
npm run dev      # esbuild watch
npm run build    # tsc type-check (no emit) then esbuild production bundle
```

Output: `main.js` in the repo root (next to `manifest.json`).

## Lint rules of note

- `eslint-plugin-obsidianmd` flags patterns that break Obsidian's renderer (e.g. `document.createElement` outside of effects, synchronous vault writes). Follow its guidance.
- `noImplicitAny` and `strictNullChecks` are on. Do not add `as any` casts.
- `useUnknownInCatchVariables` is on — type caught errors as `unknown`, not `Error`.

## What to avoid

- Do not add a bundled API key or hardcoded credentials. The plugin uses web sessions only.
- Do not read or write files outside of `app.vault` — use the Obsidian API.
- Do not introduce a backend or server. This is a purely local, client-side plugin.
- Do not render HTML strings directly (`innerHTML`). Use DOM APIs or React.
- Do not add mobile compatibility shims. This plugin is intentionally desktop-only.
