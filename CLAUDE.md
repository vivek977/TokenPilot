# Budget Agent — Claude Code Rules

<!-- Keep under 80 lines / 400 tokens. Behavior rules only — no docs prose. -->

## Session Start (do this first, every session)

1. Read `project.md` — stack, entry points, key files, structure
2. Read `.agent/brain.md` — past decisions, gotchas, do-not-repeat
3. Read `plan.md` — current goal, active step, allowed files

## Scope Contract

- Only touch files listed in the active `plan.md` step's **Files** section
- Do NOT expand to unrelated modules without explicit instruction
- After `/compact`, re-read `plan.md` to restore task context

## Exploration Rules

- Prefer **Grep** to locate symbols before **Read**
- Use **subagents** for broad research — main thread edits only, never explores
- Never glob or read: `node_modules/`, `dist/`, `out/`, `.git/`, lock files
- Treat `.claudeignore` as guidance for autonomous reads; hard blocks are in `permissions.deny`

## Code Style (TypeScript / VS Code Extension)

- Strict TypeScript — no `any`, no implicit returns
- Pure functions in `src/scanner/`, `src/packet/`, `src/lint/`, `src/brain/`, `src/selfHeal/`
- VS Code API calls only in `src/commands/`, `src/autoBootstrap/`, `src/extension.ts`
- No new npm runtime dependencies without explicit approval
- Bundle via esbuild — do not introduce webpack

## Non-negotiables

- `safeWrite()` must stat() before every write — never silently overwrite user files
- No calls to Anthropic APIs, claude.ai endpoints, or any external HTTP
- No webview panels in v1 — use QuickPick for all interactive UI
