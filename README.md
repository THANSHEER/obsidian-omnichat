# AI Chat

> An unofficial, open-source Obsidian plugin — not affiliated with or endorsed by OpenAI, Anthropic, Google, xAI, DeepSeek, or Perplexity.

AI Chat embeds AI chat services (ChatGPT, Claude, DeepSeek, Perplexity, Gemini, Grok) in a persistent Obsidian sidebar and lets you send vault notes directly into the AI's input — without leaving Obsidian.

**Desktop only** — relies on Electron's `<webview>` tag, which is unavailable in Obsidian mobile.

---

## Features

- **Six AI services in one panel** — ChatGPT, Claude, DeepSeek, Perplexity, Google Gemini, and Grok. Switch between them with a dropdown; each can be independently enabled or disabled.
- **Send selected text** — Select any text in a note and run "Send selected text to AI" from the command palette. The selection is injected directly into the chat input.
- **Vault context injection** — Add individual notes, whole folders, or all open tabs as context. Click **Add** to paste the formatted content into the AI's input box (clipboard fallback if direct injection is unavailable).
- **Context prefix** — Prepend a custom instruction to every context send, e.g. "Here are my Obsidian notes, please summarise them:".
- **Auto-clear context** — Optionally clear the context list automatically after each send, so you always start fresh.
- **Default service** — Choose which AI opens by default when the sidebar loads.
- **Context memory** — Selected files and folders are remembered across service switches and Obsidian restarts.
- **Idle auto-refresh** — Silently reloads the AI page after a configurable idle period so the service UI stays current.
- **Open on startup** — Optionally restore the sidebar automatically when Obsidian loads.
- **Light / Dark theme** — Force a light or dark colour scheme on the plugin chrome independently of Obsidian's own theme.

---

## Requirements

| Requirement | Details |
|---|---|
| Obsidian | ≥ 0.15.0 |
| Platform | macOS, Windows, or Linux desktop only |
| Node.js (dev only) | ≥ 18 |

---

## Installation

### Community plugin store (once listed)

1. Open **Settings → Community plugins → Browse**.
2. Search for **AI Chat** and click **Install**, then **Enable**.

### Manual install

1. Go to the [latest release](../../releases/latest) and download `main.js`, `manifest.json`, and `styles.css`.
2. Create the folder `<vault>/.obsidian/plugins/ai-chat/` and copy the three files into it.
3. In Obsidian, go to **Settings → Community plugins → Installed plugins** and enable **AI Chat**.

### BRAT (beta / pre-release)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin.
2. Open BRAT settings → **Add Beta Plugin** → enter this repository's URL.
3. Enable AI Chat in **Settings → Community plugins**.

---

## How it works

AI Chat uses Electron's `<webview>` element to embed the AI service websites directly inside Obsidian. This means:

- **You log in normally** — AI Chat opens the real website. Your credentials are never seen or stored by the plugin.
- **Sessions persist** — The webview uses a named Electron partition (`persist:ai-chat`) stored locally on your device. Closing and reopening Obsidian keeps you logged in.
- **Context injection is best-effort** — When you click **Add**, the plugin reads your selected notes from the vault (locally), builds a text block, copies it to the clipboard, and then attempts to insert it into the AI's input box via `executeJavaScript`. If the AI site's DOM structure changes or the webview isn't ready, the clipboard copy is the guaranteed fallback — paste manually with Cmd+V / Ctrl+V.
- **Send selected text** — Uses the same injection path but bypasses the context builder. The raw selection goes straight to the chat input.
- **No backend** — There is no server, proxy, or API key involved. All traffic goes directly from your machine to the AI service.

### Data flow

```
User selects notes / text
        │
        ▼
Plugin reads vault content locally (app.vault.read)
        │
        ▼
Builds formatted context string  ←  contextPrefix (if set)
        │
        ├──▶ navigator.clipboard.writeText   (always runs — guaranteed fallback)
        │
        └──▶ webview.executeJavaScript       (best-effort DOM injection)
                    │
                    ▼
             AI service chat input
```

---

## Usage

### Opening the panel

- Click the **chat icon** in the left ribbon, or
- Run **Open AI Chat** from the command palette (`Ctrl/Cmd+P`).

### Switching AI services

Use the dropdown at the top of the panel. The coloured dot shows the active service. Each service can be enabled or disabled in Settings.

### Sending selected text

1. Select any text in an open note.
2. Open the command palette (`Ctrl/Cmd+P`) and run **AI Chat: Send selected text to AI**.
3. The text is injected into the AI chat input (or copied to the clipboard if injection fails).

### Adding vault context

1. Use the context toolbar buttons:

   | Button | Action |
   |---|---|
   | **Active** | Adds the currently focused note |
   | **+ Open** | Adds all Markdown files open in editor tabs |
   | **+ Note** | Fuzzy-search and pick any vault note |
   | **+ Folder** | Fuzzy-search and pick a folder; all `.md` files inside are included recursively |

2. The number badge shows how many items are queued. Click it to view and remove individual items.
3. Click **Add** to inject the context into the AI's chat input.
4. Type your question and submit.

### Commands

| Command | Action |
|---|---|
| Open | Open or focus the sidebar panel |
| Open ChatGPT | Switch to ChatGPT and open the panel |
| Open Claude | Switch to Claude and open the panel |
| Open DeepSeek | Switch to DeepSeek and open the panel |
| Open Perplexity | Switch to Perplexity and open the panel |
| Open Gemini | Switch to Gemini and open the panel |
| Open Grok | Switch to Grok and open the panel |
| Send selected text to AI | Inject the editor selection into the active chat (editor must be focused) |

---

## Settings

Go to **Settings → AI Chat**.

### AI services

| Setting | Default | Description |
|---|---|---|
| Enable ChatGPT | On | Show ChatGPT in the service dropdown |
| Enable Claude | On | Show Claude in the service dropdown |
| Enable DeepSeek | On | Show DeepSeek in the service dropdown |
| Enable Perplexity | On | Show Perplexity in the service dropdown |
| Enable Gemini | On | Show Google Gemini in the service dropdown |
| Enable Grok | On | Show Grok (xAI) in the service dropdown |

### Sidebar

| Setting | Default | Description |
|---|---|---|
| Theme | Auto | Force Light or Dark on the plugin chrome, or follow Obsidian's theme |
| Default service | ChatGPT | Which AI service opens when the sidebar first loads |
| Open sidebar on startup | On | Restore the sidebar automatically when Obsidian loads |

### Browser

| Setting | Default | Description |
|---|---|---|
| Auto-refresh interval | 60 min | Silently reload the AI page after this many minutes of inactivity. Set to 0 to disable. |

### Vault context

| Setting | Default | Description |
|---|---|---|
| Auto-clear context after send | Off | Remove all context items automatically after clicking add |
| Context prefix | _(empty)_ | Text prepended to every context send, e.g. a prompt instruction |
| Max context length | 50,000 chars | Character cap; excess is truncated with a notice |

---

## Project structure

```
ai-chat/
├── src/
│   ├── main.ts                    Plugin entry — lifecycle, commands, settings
│   ├── settings.ts                DockSettings interface, defaults, settings tab UI
│   ├── constants.ts               Service URLs, ServiceKey type
│   ├── commands/
│   │   └── index.ts               Command palette registrations
│   ├── components/
│   │   └── ChatPortalPanel.tsx    Root React component (webview + context UI)
│   ├── modals/
│   │   ├── FilePickerModal.ts     Fuzzy note picker
│   │   └── FolderPickerModal.ts   Fuzzy folder picker
│   └── views/
│       └── ChatPortalView.tsx     Obsidian ItemView wrapper
├── docs/
│   ├── architecture.md            Design decisions and data-flow details
│   ├── development.md             Dev environment setup guide
│   └── contributing.md            Contribution guidelines
├── icon.svg                       Plugin logo (MIT, original artwork)
├── styles.css                     All plugin CSS (uses Obsidian CSS variables)
├── manifest.json                  Obsidian plugin manifest
├── PRIVACY.md                     Privacy policy
├── LICENSE                        MIT License
└── package.json
```

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Watch mode (rebuilds on save)
npm run dev

# 3. Symlink into your vault for live testing
#    macOS / Linux
ln -s "$(pwd)" "/path/to/vault/.obsidian/plugins/ai-chat"
#    Windows (Admin cmd)
mklink /D "%APPDATA%\obsidian\plugins\ai-chat" "%cd%"

# 4. Production build (type-check + minify)
npm run build

# 5. Lint
npm run lint
```

After making changes, toggle the plugin off and on in Obsidian, or press **Ctrl+R** in the developer console to reload.

---

## Contributing

Contributions are welcome. Please read [`docs/contributing.md`](docs/contributing.md) and [`CLAUDE.md`](CLAUDE.md) before opening a pull request.

---

## Privacy

AI Chat does not collect, transmit, or store any personal data. See [PRIVACY.md](PRIVACY.md) for the full policy.

---

## Disclaimer

AI Chat is an independent, unofficial plugin. It is not affiliated with, endorsed by, or sponsored by OpenAI (ChatGPT), Anthropic (Claude), Google (Gemini), xAI (Grok), DeepSeek, Perplexity AI, or Obsidian. All product names and logos are trademarks of their respective owners.

---

## License

MIT — see [LICENSE](LICENSE) for full text.
