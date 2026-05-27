# Installation

## Requirements

| Requirement | Details |
|---|---|
| Obsidian | 1.7.2 or newer |
| Platform | macOS, Windows, or Linux desktop only |
| Node.js (dev only) | 22 or newer |

> **Desktop only**: OmniChat relies on Electron's `<webview>` tag, which is not available in Obsidian mobile.

## Community plugin store

1. Open **Settings → Community plugins → Browse**.
2. Search for **OmniChat**.
3. Click **Install**, then **Enable**.

## Manual install

1. Open the [latest release](../../releases/latest).
2. Download `main.js`, `manifest.json`, and `styles.css`.
3. Create the folder `<vault>/.obsidian/plugins/aibrowser-chat/`.
4. Copy the three files into that folder.
5. In Obsidian, go to **Settings → Community plugins → Installed plugins** and enable **OmniChat**.

## BRAT

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin.
2. Open BRAT settings and choose **Add Beta Plugin**.
3. Paste this repository URL.
4. Enable **OmniChat** in **Settings → Community plugins**.

## Open the panel

After installation, you can open OmniChat in any of these ways:

- Click the ribbon icon.
- Run **OmniChat: Open** from the command palette.
- Assign a hotkey to **OmniChat: Toggle sidebar** in **Settings → Hotkeys**.
