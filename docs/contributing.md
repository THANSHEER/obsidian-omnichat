# Contributing

Thank you for contributing to OmniChat.

## Before you start

1. Read [AGENTS.md](../AGENTS.md).
2. Read [docs/architecture.md](architecture.md).
3. Check open issues and pull requests before starting work.

## Workflow

### 1. Fork and branch

```bash
git clone https://github.com/<your-username>/AI-Browser-Chat.git
cd AI-Browser-Chat
git checkout -b feat/your-feature-name
```

Recommended prefixes:

- `feat/` for features
- `fix/` for bug fixes
- `docs/` for documentation
- `refactor/` for internal cleanup

### 2. Set up

```bash
npm install
npm run dev
```

### 3. Make changes

- Keep TypeScript strict.
- Do not introduce `as any`.
- Keep logic in `main.ts`, `settings.ts`, `utils.ts`, `AIChatView.ts`, or modals consistent with the current architecture.
- Do not add a backend, API keys, or mobile shims.
- Prefer small, intentional changes over broad refactors.

### 4. Verify

```bash
npm run lint
npm run build
npm run test
```

### 5. Manual checks

- Main panel opens from ribbon and command palette.
- Toggle command opens and closes the panel.
- Enabled services appear correctly in the selector.
- Split panel opens and remembers its own service.
- Sessions persist across reopen.
- Active note, open tabs, note search, and folder picker all add context correctly.
- Prompt templates inject as expected.
- Context sends into chat or falls back to clipboard with a notice.
- Selected editor text sends correctly.
- Save selection and save clipboard create notes in the configured folder.
- Context truncation notice appears when limits are hit.
- Settings changes apply immediately.

### 6. Open the pull request

- Target branch: `main`
- Use a clear imperative title
- Describe what changed and how to test it

## Code style

| Rule | Detail |
|---|---|
| Indentation | Tabs |
| Quotes | Double quotes |
| Semicolons | Required |
| Trailing commas | Required for multi-line structures |
| Catch variables | Use `unknown` |
| DOM creation | Keep it inside allowed lifecycle/event paths |
| State | No global store or backend sync layer |

## Not accepted

- Bundled credentials or API keys
- File access outside `app.vault`
- Backend/server additions
- `innerHTML` rendering
- Mobile compatibility shims
