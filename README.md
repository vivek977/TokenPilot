# Venom's Token Pilot

**Make Claude Code stateful. Stop re-explaining your project every session.**

TokenPilot is a VS Code extension that manages a small set of project artifact files that Claude Code loads automatically at session start. Claude remembers what was done, what decisions were made, and what mistakes to avoid — across every session.

---

## The Problem

Claude Code has no memory between sessions. Every new session re-discovers the same bugs, re-reads the same files, re-explains the same context. On flat-rate subscriptions (Claude Max), this burns rate limits fast. On API, it burns money.

TokenPilot makes Claude stateful — the **project owns its own context**, not your chat history.

---

## How It Works

TokenPilot manages 5 artifact files that Claude Code loads automatically:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Behavior rules — session start/end protocol, scope contract, non-negotiables |
| `project.md` | Codebase map — stack, entry points, scripts, directory tree |
| `plan.md` | Task steps — current goal, active step, files in scope |
| `.claudeignore` | What Claude skips — keeps it from reading noise like `node_modules/` |
| `.agent/brain.md` | Persistent memory — status, decisions, gotchas, do-not-repeat |

### The Agentic Brain Loop

1. `CLAUDE.md` instructs Claude: read `brain.md` at session start; write updates to `.agent/updates.md` during work; update Status at session end
2. Claude appends `---UPDATE---` entries to `updates.md` as it works
3. Venom's Token Pilot watches `updates.md` and auto-merges into `brain.md` within 3 seconds (replace for Status/Active Task, append+deduplicate for others)
4. Next session: Claude reads `brain.md` and knows exactly what was done, what decisions were made, what mistakes to avoid

The brain evolves automatically across sessions with no manual maintenance required.

---

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P`):

| Command | What it does |
|---------|-------------|
| **Venom's Token Pilot: Initialize Project** | Creates all 5 artifact files from smart templates. Auto-detects stack from `package.json` / `pyproject.toml`. Skips files that already exist. |
| **Venom's Token Pilot: Refresh Project Map** | Updates `project.md` with current dependencies, entry points, scripts, and directory tree. |
| **Venom's Token Pilot: Copy Prompt Packet** | Reads the current `plan.md` step, builds a tight clipboard prompt with only the files needed for that step — prevents Claude from loading the whole repo. |
| **Venom's Token Pilot: Prune Brain** | Deduplicates bullets in `brain.md` when it gets too large. Shows a before/after count before writing. |
| **Venom's Token Pilot: Promote Insight** | Promotes selected text (or typed text) into a specific `brain.md` section as a bullet. |
| **Venom's Token Pilot: Toggle Agent Mode** | Switch between Claude Code mode (`@`-paths) and HITL (Human-in-the-Loop) mode for `claude.ai` paste. |
| **Venom's Token Pilot: Copy MCP Snippet** | Copies MCP server registration snippet for `.claude/mcp_servers.json`. |
| **Venom's Token Pilot: Merge Brain Updates** | Manually trigger a merge of `.agent/updates.md` into `brain.md`. |
| **Venom's Token Pilot: Repair Suggestions** | Runs health checks on your artifact files and offers one-click fixes. |

---

## Automatic Behaviors

- **Auto-bootstrap**: On workspace open, detects missing artifact files and offers to create them (configurable: prompt / silent / off)
- **Auto-upgrade**: Detects outdated managed files and offers to upgrade them non-destructively (`brain.md` is additive — existing bullets are preserved)
- **Auto-refresh**: Updates `project.md` automatically when `package.json` or `pyproject.toml` changes
- **Brain watcher**: Auto-merges `updates.md` to `brain.md` within 3 seconds of a write
- **CLAUDE.md linter**: Warns in the Problems panel when `CLAUDE.md` exceeds line/token limits (re-sent every message — keep it lean)

---

## Settings

All settings are prefixed `tokenPilot.`:

| Setting | Default | Description |
|---------|---------|-------------|
| `autoSetupMode` | `"prompt"` | `"prompt"` asks on open, `"trustedSilent"` auto-creates in trusted workspaces, `"off"` disables |
| `autoRefreshOnManifestChange` | `true` | Auto-refresh `project.md` when `package.json` or `pyproject.toml` changes |
| `claudeMdMaxLines` | `80` | Warn when `CLAUDE.md` exceeds this line count |
| `claudeMdMaxTokens` | `400` | Warn when `CLAUDE.md` estimated tokens (chars/4) exceed this value |
| `brainMaxLines` | `200` | Warn and offer Prune when `brain.md` exceeds this line count |
| `includeBrainInPacket` | `true` | Include brain live-state sections in prompt packets |
| `agentMode` | `"claudeCode"` | `"claudeCode"` includes `@`-paths; `"hitl"` formats for `claude.ai` paste |
| `packetMaxAtPaths` | `6` | Warn when a packet includes more than this many `@`-paths |

---

## Installation

### From VSIX (recommended)

1. Download the latest `venom-tokenpilot-X.Y.Z.vsix` from the [Releases](https://github.com/vivek977/TokenPilot/releases) page
2. Open VS Code
3. Go to Extensions (`Ctrl+Shift+X`)
4. Click `...` (More Actions) → **Install from VSIX...**
5. Select the downloaded `.vsix` file

### From Source

```bash
git clone https://github.com/vivek977/TokenPilot
cd TokenPilot
npm install
npm run package
```

Then install the generated `.vsix` as above.

---

## Requirements

- VS Code 1.85 or later
- [Claude Code CLI](https://claude.ai/code) — required for the agentic brain loop and `@`-path features
- Node.js (for building from source)

---

## Limitations

- Only works with Claude Code CLI or `claude.ai` — not other AI tools
- Brain write-back requires Claude to follow `CLAUDE.md` instructions. If Claude ignores the write-back contract, `brain.md` will not update automatically
- No API integration — works entirely through the filesystem
- `plan.md` must be manually maintained (the extension reads it but does not auto-generate tasks)
- Only supports single-root workspaces (uses the first folder)
- Tested primarily on Windows; macOS/Linux should work but is less tested
- No undo for upgrades — use VS Code's source control as your safety net

---

## License

MIT — see [LICENSE](LICENSE)

**Author & Publisher:** venom | **GitHub:** [https://github.com/vivek977/TokenPilot](https://github.com/vivek977/TokenPilot)

> Copyright (c) 2026 venom. All copies and forks must retain the original copyright notice.
