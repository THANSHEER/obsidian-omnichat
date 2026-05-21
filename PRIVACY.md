# Privacy Policy — ChatPortal

_Last updated: 2026-05-18_

ChatPortal is a local Obsidian plugin. This policy explains exactly what data is and is not collected.

---

## What ChatPortal does NOT do

- **Does not collect any personal data.** No names, email addresses, user IDs, or any identifying information are ever collected.
- **Does not send data to the plugin author's servers.** There are no servers operated by this plugin. There is no backend.
- **Does not contain analytics or telemetry.** There is no tracking, crash reporting, or usage monitoring of any kind.
- **Does not store API keys.** ChatPortal uses web sessions only; it never asks for or stores API credentials.
- **Does not read your vault beyond what you explicitly select.** The plugin only reads note content when you click the **Add** or **Send selected text** buttons.

---

## What ChatPortal does locally

### Session cookies

When you log in to an AI service inside the panel, the session cookie is stored in an Electron partition named `persist:chatportal` on your local device. This is standard browser session storage — it keeps you logged in across Obsidian restarts. The data never leaves your device via the plugin.

Location of Electron partition data:
- **macOS:** `~/Library/Application Support/obsidian/Partitions/persist_chatportal/`
- **Windows:** `%APPDATA%\obsidian\Partitions\persist_chatportal\`
- **Linux:** `~/.config/obsidian/Partitions/persist_chatportal/`

You can clear this data by removing the folder above, which will log you out of all AI services in the panel.

### Context items

The list of notes and folders you add to the context panel is saved to your vault's plugin data file (`<vault>/.obsidian/plugins/chatportal/data.json`). This file is local to your vault. It is never uploaded or shared by the plugin.

---

## Third-party AI services

When you click **Add** or **Send selected text**, your vault content is sent to whichever AI service is open in the panel — the same as if you had typed it yourself. That data is then subject to the privacy policy of the respective service:

| Service | Privacy Policy |
|---|---|
| ChatGPT (OpenAI) | https://openai.com/policies/privacy-policy |
| Claude (Anthropic) | https://www.anthropic.com/legal/privacy |
| Google Gemini | https://policies.google.com/privacy |
| Grok (xAI) | https://x.ai/legal/privacy-policy |
| DeepSeek | https://www.deepseek.com/privacy_policy |
| Perplexity AI | https://www.perplexity.ai/privacy |

Before sending sensitive or confidential information to any AI service, review that service's data retention and training policies.

---

## Open source

ChatPortal's source code is fully open and auditable at [GitHub](../../). Anyone can verify these claims by reading the code.

---

## Contact

For privacy questions or concerns, open an issue on the GitHub repository.
