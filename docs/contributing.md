# Contributing

Thank you for your interest in contributing to ChatPortal. This document covers the workflow, code expectations, and review process.

---

## Before you start

1. **Read [`CLAUDE.md`](../CLAUDE.md)** — the AI contributor guide. It describes the architecture, key design decisions, and patterns to follow. New code must fit this structure.
2. **Read [`docs/architecture.md`](architecture.md)** — understand the data flow and why the webview is managed imperatively.
3. **Check open issues and pull requests** to avoid duplicating work.

---

## Workflow

### 1. Fork and branch

```bash
# Fork on GitHub, then:
git clone https://github.com/<your-username>/ChatPortal.git
cd ChatPortal
git checkout -b feat/your-feature-name
# or
git checkout -b fix/short-description
```

Branch naming:
- `feat/<name>` — new functionality
- `fix/<name>` — bug fix
- `docs/<name>` — documentation only
- `refactor/<name>` — internal restructure with no behaviour change

### 2. Set up your environment

```bash
npm install
npm run dev        # start watch build
```

See [`docs/development.md`](development.md) for vault linking instructions.

### 3. Make changes

- Follow the existing code style (2-space indentation, TypeScript strict mode, no `as any`).
- Do not add features beyond what the issue or PR description asks for.
- Do not add comments that describe *what* the code does — only add comments for non-obvious *why* (hidden constraints, workarounds, subtle invariants).
- No `console.log` statements in committed code.
- If you add a new setting, follow the pattern in [`Adding a new setting`](architecture.md#adding-a-new-setting).
- If you add a new AI service, follow the pattern in [`Adding a new AI service`](architecture.md#adding-a-new-ai-service).

### 4. Lint, build, and test

```bash
npm run lint       # must pass with no errors
npm run build      # must complete without type errors
npm test           # all unit tests must pass
```

All three checks run in CI; failing any will block the PR.

### 5. Test manually

Test the following before submitting:

- [ ] Panel opens from the ribbon icon and from the command palette.
- [ ] Service dropdown switches between all six services correctly.
- [ ] Sessions persist after closing and reopening the panel.
- [ ] Active file, open files, note picker, and folder picker all add items correctly.
- [ ] Duplicate items are not added.
- [ ] Add injects context into the AI input (or falls back to clipboard with a notice).
- [ ] Send selected text injects the selection into the active chat input.
- [ ] Context truncation notice fires when the limit is exceeded.
- [ ] Clear all removes all items and closes the list.
- [ ] Settings changes (enable/disable service, max length, prefix) are reflected immediately.
- [ ] Plugin unloads cleanly (no errors in console when disabling).

### 6. Open a pull request

- Base branch: `main`
- Title: short imperative verb phrase — e.g. "Add Perplexity AI service support"
- Description: what changed, why, and how to test it manually
- Reference any related issue with `Closes #<number>`

---

## Code style quick reference

| Rule | Detail |
|---|---|
| Indentation | 2 spaces (enforced by `.editorconfig`) |
| Quotes | Double quotes for strings |
| Semicolons | Required |
| Trailing commas | Required in multi-line structures |
| No `any` | Use proper types or `unknown` |
| Catch variables | Typed as `unknown`, not `Error` |
| DOM creation | Inside `useEffect` or event handlers only |
| State | Props down, callbacks up — no context providers or global stores |
| Modals | Class-based extending Obsidian's `Modal` or `FuzzySuggestModal` |
| Comments | Only when the WHY is non-obvious |

---

## What will not be accepted

- Bundled API keys or hardcoded credentials of any kind.
- Reading or writing files outside of `app.vault` (use the Obsidian API).
- Any backend server or external network dependency beyond the AI service URLs.
- `innerHTML` assignments — use DOM APIs or React.
- Abstractions not required by the task (premature generalization, unused helpers, etc.).

---

## Questions

Open a [GitHub Discussion](https://github.com/THANSHEER/ChatPortal/discussions) for design questions or ideas before investing time in a large PR. For bugs, open an issue with reproduction steps.
