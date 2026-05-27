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

## What happens when you send context

OmniChat is a browser wrapper. When you click **Add** or use **Send selected text to AI**, the plugin sends your text directly into the currently open AI website, just as if you pasted it there yourself.

That means the privacy policy of the active AI provider applies to anything you send into that service.

## Source transparency

The source is public at [THANSHEER/AI-Browser-Chat](https://github.com/THANSHEER/AI-Browser-Chat).
