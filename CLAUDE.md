# Claude.ai agent — Claude Code Rules

<!-- venom-tokenpilot-version: 0.1.5 -->
<!-- Keep under 80 lines / 400 tokens. Behavior rules only — no docs prose. -->

## Session Start (do this FIRST — no exceptions)

1. Read `project.md` — stack, entry points, key files
2. Read `.agent/brain.md` — check **Status** (current state), **Active Task** (anything in flight?), **Pending** (what's queued)
3. Read `plan.md` — current goal, active step, allowed files
4. If **Active Task** is not `(none)`: that task was interrupted — resume it or record why you are not

## Session End (do this LAST — before stopping)

Append to `.agent/updates.md`:

```
---UPDATE---
target: Status
date: YYYY-MM-DD
One sentence: what is working, what is broken, what is half-done.
---END---

---UPDATE---
target: Active Task
date: YYYY-MM-DD
- (none)
---END---
```

Also append one entry per decision, gotcha, or mistake discovered this session.

## During Work (write-back contract)

- START a task → append `target: Active Task` with what you are doing
- DISCOVER a gotcha or make a decision → immediately append to `.agent/updates.md`
- FIX a mistake → append `target: Do-Not-Repeat` entry
- FINISH a task → append `target: Active Task` with `- (none)` and update Status
- After `/compact` → re-read `plan.md` AND `.agent/brain.md` before continuing

## Scope Contract

- Only touch files listed in the active `plan.md` step's **Files** section
- Do NOT expand to unrelated modules without explicit instruction
- Use **subagents** for broad research — main thread edits only

## Exploration Rules

- Prefer **Grep** to locate symbols before **Read**
- Never glob or read: `node_modules/`, `dist/`, `out/`, `.git/`, lock files
- Treat `.claudeignore` as guidance for autonomous reads

## Non-negotiables

<!-- Add project-specific hard rules here -->
