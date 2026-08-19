<p align="center">
  <img src="https://raw.githubusercontent.com/THANSHEER/media-hub/main/obsidian-omnichat/logo/logo.svg" width="120" alt="OmniChat Logo">
</p>

<h1 align="center">OmniChat</h1>

<p align="center">
  <strong>Keep ChatGPT, Claude, Gemini, Perplexity, and your other favorite AI tools inside one seamless Obsidian sidebar.</strong>
</p>

<p align="center">
  <a href="https://obsidian.md/plugins?id=aibrowser-chat">
    <img src="https://img.shields.io/badge/Obsidian-1.7.2%2B-7C3AED?logo=obsidian&logoColor=white" alt="Obsidian Version">
  </a>&nbsp;&nbsp;
  <a href="https://obsidian.md/">
    <img src="https://img.shields.io/badge/-Desktop-111827?logo=monitor&logoColor=white" alt="Desktop">
  </a>&nbsp;&nbsp;
  <a href="https://github.com/THANSHEER/obsidian-omnichat">
    <img src="https://img.shields.io/github/stars/THANSHEER/obsidian-omnichat?style=social" alt="GitHub stars">
  </a>&nbsp;&nbsp;
  <a href="https://obsidian.md/plugins?id=aibrowser-chat">
    <img src="https://img.shields.io/badge/dynamic/json?logo=obsidian&color=7C3AED&label=downloads&query=%24%5B%22aibrowser-chat%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json" alt="Downloads">
  </a>&nbsp;&nbsp;
  <a href="https://github.com/THANSHEER/obsidian-omnichat/blob/main/LICENSE.txt">
    <img src="https://img.shields.io/github/license/THANSHEER/obsidian-omnichat?color=blue" alt="License">
  </a>
</p>

## Why OmniChat?

OmniChat is a powerful desktop-only Obsidian plugin that embeds AI chat websites in a persistent sidebar. It allows you to seamlessly send selected text, inject vault context into your active chat, and save responses back into your Obsidian vault—all without leaving your workflow.

- **10 Built-in Services:** Switch instantly between ChatGPT, Claude, DeepSeek, Perplexity, Gemini, Grok, Copilot, Manus AI, Kimi, and Ollama from a single panel.
- **Bring Your Own AI:** Add custom AI tools by URL and keep them within the same quick selector.
- **Send Selection:** Send selected editor text straight into the active chat with a single click.
- **Build Context:** Build reusable vault context from your notes, open tabs, or full folders, then inject it instantly.
- **Prompt Templates:** Streamline repeated workflows with custom prompt templates.
- **Split View:** Open a second split panel to keep two AI services visible side by side.
- **Save Responses:** Copy text in the AI page (Cmd+C / Ctrl+C) and click Save to securely store responses in your vault.
- **Persistent Sessions:** Keep all your chats logged in and active across Obsidian restarts.

---

## Features in Action

### Service Switching
Switch seamlessly between different AI models and add your own custom URLs.
<p align="center">
  <img src="https://raw.githubusercontent.com/THANSHEER/media-hub/main/obsidian-omnichat/animated-webp/Service%20switching.webp" alt="Service Switching" width="760">
</p>

### Send Selection to AI
Easily select text in your active note and push it directly into the AI chat.
<p align="center">
  <img src="https://raw.githubusercontent.com/THANSHEER/media-hub/main/obsidian-omnichat/animated-webp/Send%20selection%20%E2%86%92%20AI.webp" alt="Send Selection" width="760">
</p>

### Build & Inject Context
Collect context from specific folders or notes and inject them straight into the chat prompt.
<p align="center">
  <img src="https://raw.githubusercontent.com/THANSHEER/media-hub/main/obsidian-omnichat/animated-webp/Build%20context%20%E2%86%92%20inject.webp" alt="Build Context" width="760">
</p>

---

## Roadmap

- [x] Embed major AI services (ChatGPT, Claude, Gemini, Perplexity, DeepSeek, etc.)
- [x] Quick service switching menu
- [x] Add custom AI tool URLs
- [x] Send active editor selection directly to chat
- [x] Build and inject vault context (notes, tabs, folders)
- [x] Custom prompt templates
- [x] Dual split-panel view
- [x] Save responses to active notes
- [x] Persistent webview sessions
- [x] Dedicated settings for specific AI configurations
- [ ] Auto-generate tags and properties for saved responses
- [ ] Custom system prompt support for injected context
- [x] Support for local LLMs (Ollama)

---

## Installation

See [docs/installation.md](docs/installation.md) for full instructions on installing via the Obsidian Community Store, manual installation, or using BRAT.

---

## Documentation

| Guide | Description |
|---|---|
| [Installation](docs/installation.md) | Community plugin, manual install, and BRAT instructions. |
| [Settings](docs/settings.md) | Details on every setting, command, and service toggle. |
| [Development](docs/development.md) | Local setup, building, testing, and release workflows. |
| [Architecture](docs/architecture.md) | Data flow, webview lifecycle, and persistence models. |
| [Contributing](docs/contributing.md) | Contribution rules and code review expectations. |

---

## Privacy

OmniChat does **not** run a backend server and does **not** collect telemetry or user data. Everything runs locally within your Obsidian environment. See our full [Privacy Policy](https://geekstash.dev/omnichat/privacy).

## Support

If you find this plugin helpful, consider supporting its development:

[![Buy Me a Coffee at ko-fi.com](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/thansheer)

Or leave a star on [GitHub](https://github.com/THANSHEER/obsidian-omnichat).

## Disclaimer

OmniChat is an independent plugin and is **not** affiliated with OpenAI, Anthropic, Google, Microsoft, xAI, DeepSeek, Moonshot AI, Perplexity, or Obsidian.

## License

MIT License. See [LICENSE.txt](LICENSE.txt) for details.
