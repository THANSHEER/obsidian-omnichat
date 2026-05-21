# Architecture

This document describes how ChatPortal is structured, how data flows through it, and the key design decisions behind it.

---

## What the plugin does

ChatPortal embeds AI chat services (ChatGPT, Claude, DeepSeek, Perplexity, Gemini, Grok) in an Obsidian sidebar using an Electron `<webview>`. It also provides a vault context feature: the user selects notes or folders, clicks **Add**, and the note content is injected into the AI chat input (or copied to the clipboard if injection is unavailable).

---

## Tech stack

| Concern | Choice |
|---|---|
| Plugin framework | Obsidian Plugin API (`obsidian` npm package) |
| UI | React 18 (JSX transform, no class components) |
| Language | TypeScript (strict mode) |
| Build | esbuild |
| Linting | ESLint + `typescript-eslint` + `eslint-plugin-obsidianmd` |

---

## Module map

```
src/
  main.ts            Plugin entry point. Owns lifecycle, settings load/save,
                     view registration, ribbon, and command registration.

  settings.ts        DockSettings interface, DEFAULT_SETTINGS, and
                     ChatPortalSettingTab. All persisted state lives here.
                     contextItems carries the persistent context memory.

  constants.ts       URL constants for all six AI services.

  commands/
    index.ts         registerCommands() — thin wrappers that call methods on
                     ChatPortalPlugin. Logic stays in main.ts.

  views/
    ChatPortalView.tsx   Obsidian ItemView that mounts the React root.
                         ChatPortalView.renderView() is the single call site
                         that renders <ChatPortalPanel>. New plugin-level state
                         is threaded down as props here.

  components/
    ChatPortalPanel.tsx  Root React component. Owns the <webview> lifecycle
                         (create, src updates, event listeners, teardown)
                         and the context injection logic.

  modals/
    FilePickerModal.ts    FuzzySuggestModal<TFile> — picks a single note.
    FolderPickerModal.ts  FuzzySuggestModal<TFolder> — picks a folder.
                          Both are Obsidian class-based. Instantiate with
                          `new XModal(app, callback).open()` inside handlers.
```

---

## Data flow

```
User action (button click)
  │
  ├─ Switch service → setActiveUrl → webview.src updated → webview navigates
  │
  └─ Context management:
       addActiveFile / addFile / addFolder / addAllOpenFiles
         → setItems (React state)
         → useEffect fires → onContextItemsChange(items)
         → plugin.setContextItems(items)
         → saveSettings() (persisted to data.json)

User clicks Add
  │
  ├─ handleSendContext() reads vault files via app.vault.read()
  ├─ Formats context string
  ├─ navigator.clipboard.writeText(context)   ← always runs (reliable fallback)
  └─ webview.executeJavaScript(injectScript)  ← best-effort; may fail silently
       on success → Notice "Context pasted in chat"
       on failure → Notice "Context copied — paste with Cmd+V / Ctrl+V"
```

---

## Key design decisions

### Webview created imperatively, not declaratively

React cannot reliably render Electron's `<webview>` tag. The element is created with `document.createElement("webview")`, appended to a `div` ref inside a `useEffect`, and removed on cleanup. Do not attempt to render `<webview>` inside JSX.

### Context injection is best-effort

`executeJavaScript` may fail if the webview hasn't fully loaded, the target site changed its DOM structure, or Electron IPC is not ready. The clipboard copy runs first (before any injection attempt), so the user always has a reliable path to paste the context.

### Context persistence via settings

Selected files and folders are saved to `DockSettings.contextItems` whenever they change (through the `onContextItemsChange` prop callback → `plugin.setContextItems` → `saveData`). This gives the user persistent "memory" across service switches and Obsidian restarts with no extra infrastructure.

### No global state, no stores

State flows down via props and up via callbacks. The component tree is shallow enough that prop drilling is fine. Do not introduce a Context provider or state library.

### Modals are class-based, not hooks

Obsidian modals extend `FuzzySuggestModal` or `Modal`. They must be instantiated inside event handlers; do not try to render them as React components.

### Desktop-only, no mobile

`manifest.json` sets `"isDesktopOnly": true`. The `<webview>` Electron API does not exist in Obsidian mobile. There is no mobile fallback and none is planned. Do not add mobile compatibility shims.

---

## Adding a new AI service

The service selector is a native `<select>` — adding a new service is one `<option>` line plus a few supporting entries.

1. Add a URL constant in `constants.ts`.
2. Add an entry to `SERVICE_URLS` in `ChatPortalPanel.tsx`.
3. Add a URL-pattern match in `getServiceKey()` in `utils.ts`.
4. Add `<option value="newkey">Service Name</option>` inside the `<select>` in `ChatPortalPanel.tsx`.
5. Add a `pd-svc-dot--newkey` colour rule in `styles.css`.
6. Add `enableNewService` to `DockSettings` + `DEFAULT_SETTINGS` in `settings.ts`, wire the settings tab toggle, and pass the new prop from `ChatPortalView.renderView()`.
7. Add `openNewService()` in `main.ts` and a command entry in `commands/index.ts`.

## Adding a new setting

1. Add the field to `DockSettings` in `settings.ts` with a default in `DEFAULT_SETTINGS`.
2. Add a `new Setting(containerEl)…` block in `ChatPortalSettingTab.display()`.
3. Pass it down as a prop from `ChatPortalView.renderView()` if the component needs it.

---

## Build output

esbuild bundles everything into a single `main.js` in the repo root. Obsidian loads this file, `manifest.json`, and `styles.css` from the plugin directory. Source maps are inlined in dev mode and stripped in production.
