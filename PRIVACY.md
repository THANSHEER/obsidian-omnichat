# Privacy Policy — OmniChat

OmniChat is a local Obsidian plugin. This policy explains what the plugin stores locally and what it does not collect.

## What OmniChat does not do

- It does not run a backend service.
- It does not send telemetry to the author.
- It does not collect analytics.
- It does not store API keys.

## What OmniChat stores locally

### Service sessions

When you sign in to an AI service inside the panel, the session is stored by Electron in the local partition `persist:aibrowser-chat` so you stay signed in across Obsidian restarts.

- macOS: `~/Library/Application Support/obsidian/Partitions/persist_aibrowser-chat/`
- Windows: `%APPDATA%\\obsidian\\Partitions\\persist_aibrowser-chat\\`
- Linux: `~/.config/obsidian/Partitions/persist_aibrowser-chat/`

### Plugin settings

Plugin settings are stored in your vault under:

`<vault>/.obsidian/plugins/aibrowser-chat/data.json`

This can include:

- enabled services
- saved context item paths
- prompt templates
- custom service URLs
- save-folder configuration
- theme and startup preferences

## Vault file access

OmniChat enumerates vault file paths in two situations, both triggered by explicit user action:

- **Pick note** — when you open the note search modal to add a note to context, the plugin lists all Markdown files so you can search them by name or content.
- **Append to existing note** — when you choose to append an AI response to an existing note, the plugin lists all Markdown files so you can pick a target.

File contents may be read locally to support content search in **Pick note**, when you click **Add** to send context to the AI, or when appending a saved response.

## Clipboard access

OmniChat reads and writes the system clipboard in two situations:

- **Writes to clipboard** — when the plugin cannot inject text directly into the AI page (the AI site's DOM may block this), it automatically copies the text to your clipboard so you can paste with Cmd+V / Ctrl+V. This is the reliable fallback path for the **Add**, **Copy**, and **Send selected text** features.
- **Reads from clipboard** — only when you explicitly click **Save**, which reads whatever is currently on your clipboard and saves it as a vault note.

No clipboard content is ever sent anywhere other than the AI service page you are actively using.

## What happens when you send context

OmniChat is a browser wrapper. When you click **Add** or use **Send selected text to AI**, the plugin sends your text directly into the currently open AI website, just as if you pasted it there yourself.

That means the privacy policy of the active AI provider applies to anything you send into that service.

## Source transparency

The source is public at [THANSHEER/AI-Browser-Chat](https://github.com/THANSHEER/AI-Browser-Chat).
