# Development Guide

Everything you need to get the plugin running locally, understand the build system, and iterate quickly.

---

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Node.js | 18 | Runtime for build tools |
| npm | 9 | Package manager |
| Git | any | Version control |
| Obsidian (desktop) | 0.15.0 | Plugin host |

---

## Initial setup

```bash
# 1. Clone
git clone https://github.com/THANSHEER/ChatPortal
cd ChatPortal

# 2. Install dependencies
npm install
```

No environment variables or external services are required. The plugin runs entirely locally.

---

## Build commands

| Command | What it does |
|---|---|
| `npm run dev` | esbuild in watch mode — rebuilds `main.js` on every file save |
| `npm run build` | Type-check (`tsc --noEmit`) then production build (minified, no sourcemaps) |
| `npm run lint` | ESLint across all TypeScript source files |
| `npm run version` | Bumps version in `manifest.json` and `versions.json`, then stages both |

All build output lands in the **repo root** as `main.js` (not in a `dist/` folder), alongside `manifest.json` and `styles.css`. This is how Obsidian expects plugin files to be laid out.

---

## Linking the plugin into a vault

Symlinking the repo directory into an Obsidian vault's plugin folder gives you zero-copy hot-reload during development:

```bash
# macOS / Linux
ln -s "$(pwd)" "/Users/<you>/path-to-vault/.obsidian/plugins/ChatPortal"

# Windows — run as Administrator in Command Prompt
mklink /D "%APPDATA%\obsidian\plugins\ChatPortal" "%cd%"
```

Then:
1. Open Obsidian → **Settings → Community plugins → Installed plugins**.
2. Find **ChatPortal** and enable it.
3. After any code change, either:
   - Open Obsidian's developer console (`Ctrl+Shift+I`) and press **Ctrl+R** to reload, or
   - Toggle the plugin off and back on in settings.

> **Tip**: Enable "Safe mode" off and keep the developer tools open (View → Toggle Developer Tools) for quick access to console logs and element inspection inside the webview.

---

## Project layout

```
src/
  main.ts                    Plugin lifecycle, settings, view/command registration
  settings.ts                Persistent settings interface and settings tab UI
  constants.ts               Service URL constants
  commands/index.ts          Command palette entry points
  components/
    ChatPortalPanel.tsx       Root React component — webview + context toolbar
  modals/
    FilePickerModal.ts        Fuzzy note picker modal
    FolderPickerModal.ts      Fuzzy folder picker modal
  views/
    ChatPortalView.tsx        Obsidian ItemView wrapper that mounts the React tree
styles.css                   All CSS using Obsidian CSS custom properties
manifest.json                Plugin metadata (id, version, minAppVersion, isDesktopOnly)
esbuild.config.mjs           Bundle config: external deps, JSX transform, CJS output
tsconfig.json                TypeScript config: ES2018 target, strict mode, no emit
eslint.config.mts            ESLint: typescript-eslint + eslint-plugin-obsidianmd
```

---

## esbuild configuration notes

- **Format**: CommonJS (`cjs`) — required by Obsidian's plugin loader.
- **JSX**: `automatic` — uses React 18's JSX transform, no `import React` needed per file.
- **Target**: `es2018` — matches Obsidian's minimum Electron version.
- **External**: `obsidian`, `electron`, all `@codemirror/*` and `@lezer/*` packages, and Node built-ins are external — Obsidian provides them at runtime.
- **Sourcemaps**: inlined in dev mode, stripped in production.
- **Tree-shaking**: enabled — unused exports are dropped.

---

## TypeScript notes

Strict mode is fully enabled:
- `noImplicitAny` — no untyped `any` escapes
- `strictNullChecks` — null/undefined must be handled explicitly
- `useUnknownInCatchVariables` — caught errors are typed `unknown`, not `Error`

Avoid `as any` casts. If you need to access a property that TypeScript doesn't know about, use a typed local interface or a type guard.

---

## ESLint rules of note

`eslint-plugin-obsidianmd` catches patterns that break in Obsidian's renderer environment:

- `document.createElement` called outside of a `useEffect` or event handler — triggers a lint error. Always create DOM elements inside effects.
- Synchronous vault writes — use the async Obsidian API.

Run `npm run lint` before opening a PR. The CI pipeline will also run it.

---

## Debugging

### Browser devtools inside the webview

Right-click inside the embedded webview → **Inspect Element** (if `allowpopups` permits). Alternatively, open Obsidian's main developer console and run:

```js
require('electron').remote.webContents.getAllWebContents()
```

to find the webview's `webContents` and open a dedicated devtools window for it.

### Logging

Use `console.log` freely during development — all output appears in Obsidian's developer console. Remove or gate logs behind a debug flag before committing.

### Context injection failures

`executeJavaScript` errors are silently caught in `handleSendContext`. To debug injection, temporarily remove the `catch {}` block and watch the console. The most common causes are:
- The webview hasn't finished loading (`dom-ready` not yet fired)
- The target site changed its input selector
- The Electron partition is blocked by content security policy

---

## Releasing a new version

1. Update `package.json` version.
2. Run `npm run version` — this updates `manifest.json` and `versions.json` and stages them.
3. Run `npm run build` to generate the final `main.js`.
4. Commit and tag: `git tag <version> && git push --tags`.
5. Create a GitHub release and attach `main.js`, `manifest.json`, and `styles.css` as release assets.
