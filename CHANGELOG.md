# Changelog

All notable changes to OmniChat are documented in this file.

## [1.7.3] - 2026-08-24

### v1.7.3 - Seamless Google Sign-In & Browser Emulation

Fixes authentication issues with Google Sign-In on Perplexity, ChatGPT, and other AI services by providing full desktop Chrome emulation and dedicated OAuth flow handling.

### Improvements & Fixes

- **Google Sign-In & OAuth Fix**: Added dedicated OAuth popup handling that keeps the active chat session intact while completing login in a shared-session modal.
- **Authentic Chrome Emulation**: Injected genuine Chrome Client Hints (`sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`) and runtime environment properties to prevent `disallowed_useragent` (403) blocks.
- **Custom User-Agent & Session Tools**: Added advanced settings to customize the User-Agent string and easily clear browser cookies/cache.

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.7.2] - 2026-08-20

### v1.7.2 - Review & Linter Compliance

Fixes and improvements to meet Obsidian community plugin review guidelines.

### Fixes

- Replaced element creation helper with `createSpan` in the welcome modal to adhere to Obsidian DOM conventions
- Removed rule disable comment and updated webview User-Agent detection to conform with Obsidian platform review checks

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.7.1] - 2026-08-19

### v1.7.1 - Maintenance & Quality Improvements

Quality improvements and automated validation to ensure smooth community releases.

### Improvements

- Added automated Obsidian manifest, security, and release asset validation
- Enhanced continuous integration workflows across all branches

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.7.0] - 2026-08-19

### v1.7.0 - Open Source License Update

OmniChat is now officially licensed under the MIT License.

### Improvements

- Updated the repository license from Apache 2.0 to MIT for simpler and broader open-source use

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.6.0] - 2026-08-16

### v1.6.0 - Feedback, Onboarding, and Update Notes

A new way to tell us what's working (or not), a friendlier first run, and a heads-up on what changed after every update.

### Features

- Added a Feedback section in settings to send general feedback, request a feature, or share uninstall feedback anytime
- Added an optional survey when you uninstall OmniChat (not shown when you only disable it)
- Added a short welcome tour the first time you open OmniChat
- OmniChat now shows what's new after updating to a new version

### Improvements

- OmniChat now presents itself to AI sites using your actual operating system and browser version for more reliable sign-ins
- Added screen reader labels to the context toolbar buttons
- Context and template menus feel snappier

### Fixes

- Fixed the service selector occasionally losing your selection when settings changed

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.5.1] - 2026-07-19

### v1.5.1 - Stability Fixes

Small fixes to keep the sidebar running smoothly.

### Fixes

- Fixed the AI panel and Ollama sometimes sharing the same view unexpectedly
- Improved overall stability and security

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.5.0] - 2026-07-19

### v1.5.0 - Native Ollama Support

You can now chat with your local Ollama models right alongside the other AI services.

### Features

- Built-in support for Ollama, with its own dedicated view
- Added a setting to customize the Ollama API URL, for remote or custom-port setups

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.4.2] - 2026-06-21

### v1.4.2 - Smarter Saving

Saving AI responses to your notes is now easier and cleaner.

### Features

- AI responses can automatically clean up into proper tables and code blocks when saved
- Insert an AI response directly at your cursor as a new save option
- Saved notes now record which AI service and date they came from
- Save the current AI response from the command palette

### Improvements

- Searching notes for context now loads faster

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.4.0] - 2026-06-12

### v1.4.0 - New Template Options and Safer Clearing

Prompt templates got smarter, and clearing your context is now harder to do by accident.

### Features

- Two new template variables to auto-insert a note's path or its tags
- Clear all context straight from the command palette
- Choose which AI service opens by default in the split panel

### Improvements

- Clearing all context now asks for confirmation first, so you don't lose your list by accident

### Fixes

- Fixed duplicate custom services being added silently
- Fixed saved files overwriting each other when saved quickly in a row
- Fixed a confusing message when cycling services with none enabled
- Fixed the context size label showing the wrong units
- Fixed the plugin showing an incorrect browser identity to AI sites

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.3.1] - 2026-06-06

### v1.3.1 - Under-the-Hood Fixes

Small reliability improvements to how AI services are handled.

### Fixes

- Improved reliability when switching between AI services

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.3.0] - 2026-06-06

### v1.3.0 - Renamed to OmniChat

The plugin is now officially called OmniChat everywhere you see it.

### Improvements

- Renamed from "AI Portal" to "OmniChat" throughout the plugin

### Fixes

- Fixed leftover "AI Portal" text in the ribbon icon and notifications
- Fixed a naming mismatch that caused a warning in the Obsidian plugin store

### Security

- Resolved underlying security vulnerabilities in the plugin's build tools

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.2.0] - 2026-05-27

### v1.2.0 - Templates, Split View, and Copilot Support

One of the biggest updates yet: one-click prompts, a side-by-side view, and finer control over what you send as context.

### Features

- One-click prompt templates you can trigger from settings
- Open two AI services at once with the new split panel
- Added support for Copilot, Manus, and Kimi
- Auto-add the current note to context when the panel opens
- Strip note formatting before sending it as context
- Auto-clear context after each send
- Add custom text before every context send
- Set a maximum size limit for context sends
- Cycle through your enabled AI services with a command (assignable to a hotkey)

### Improvements

- Smaller, faster plugin after trimming extra dependencies

### Security

- Fixed a security issue that could let unsafe web addresses load in the panel

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.1.2] - 2026-05-22

### v1.1.2 - Fixed Sidebar Height

The AI panel now properly fills the sidebar again.

### Fixes

- Fixed the AI panel collapsing into a small box instead of filling the sidebar
- Removed extra empty space above the service selector

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.1.1] - 2026-05-22

### v1.1.1 - Layout Polish

Continued layout cleanup for the sidebar.

### Fixes

- Fixed remaining spacing and alignment issues in the sidebar

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.1.0] - 2026-05-21

### v1.1.0 - Fixed Display Issues

Cleaned up layout problems that appeared after the first release.

### Features

- Right-click context menu support
- A command to toggle the AI panel on and off

### Fixes

- Fixed the AI panel not filling the full sidebar height
- Fixed toolbar buttons stacking vertically instead of staying in a row

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes.

## [1.0.0] - 2026-05-21

### v1.0.0 - OmniChat Launches

Bring your favorite AI chat sites into Obsidian's sidebar, and send your notes straight into them without leaving the app.

### Features

- Chat with ChatGPT, Claude, DeepSeek, Perplexity, Gemini, or Grok, each toggled on or off individually
- Send selected text to your AI with one command
- Add the current note, all open tabs, any note, or a whole folder as context
- Prepend a custom instruction to every context send
- Optionally clear context automatically after each send
- Choose which AI opens by default
- Context selections are remembered across restarts
- Keeps your AI session fresh with an optional idle refresh
- Sidebar can reopen automatically when Obsidian starts

---

**How to Update:** Install from Obsidian Community Plugins.

No breaking changes. This is an unofficial plugin, not affiliated with OpenAI, Anthropic, Google, xAI, DeepSeek, or Perplexity. No API keys, no backend, no data collection.
