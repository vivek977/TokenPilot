# Venom's Token Pilot

A VS Code extension that manages the files Claude Code loads at session start — so you spend less time re-explaining your project and more time getting work done.

---

## What it actually does

Claude Code has no memory between sessions. Every new session starts cold: no knowledge of what was built, what decisions were made, what broke last time. This extension manages a small set of text files that Claude Code loads automatically, giving it a starting point each session.

**The extension manages files. Claude reads and writes those files. That's the whole system.**

There is no API integration. There is no AI inside the extension. The extension cannot force Claude to do anything — it can only prepare files and watch for Claude's output.

---

## The files it manages

| File | What it is |
|------|------------|
| `CLAUDE.md` | Instructions Claude Code loads automatically every session — session start checklist, write-back rules, scope constraints |
| `project.md` | Your project's stack, entry points, scripts, and directory tree — auto-populated from `package.json` / `pyproject.toml` |
| `plan.md` | Your current goal, broken into steps with files in scope — you write this, Claude reads it |
| `.claudeignore` | Paths Claude should skip — reduces autonomous reads of noise like `node_modules/` |
| `.agent/brain.md` | Persistent memory — status, decisions, gotchas, mistakes. Claude appends here, extension merges automatically |
| `.agent/updates.md` | Staging file — Claude appends `---UPDATE---` entries here; extension auto-merges to `brain.md` within 3 seconds |

---

## The brain loop

This is the core mechanic. When it works, the brain evolves across sessions automatically:

1. `CLAUDE.md` instructs Claude to append `---UPDATE---` entries to `.agent/updates.md` as it works
2. The extension watches `updates.md` and merges entries into `brain.md` within 3 seconds
3. `Status` and `Active Task` sections are **replaced** on each merge; all other sections **append** (deduplicated)
4. Next session, Claude reads `brain.md` and has context from previous sessions

**When it doesn't work:** The loop depends entirely on Claude following the instructions in `CLAUDE.md`. If Claude skips the write-back step, `brain.md` stays static. The extension detects a stale brain on workspace open (compares the newest date stamp in `brain.md` against the last git commit date) and copies a recovery prompt to clipboard — but you still have to paste it.

---

## Commands

All available via `Ctrl+Shift+P`:

| Command | What it does |
|---------|-------------|
| **Initialize Project** | Creates all 6 artifact files from templates. Reads `package.json` / `pyproject.toml` to pre-fill stack info. Skips files that already exist — never overwrites. |
| **Refresh Project Map** | Updates `project.md` with current dependencies, entry points, scripts, and top-level directory tree from the manifest. |
| **Copy Prompt Packet** | Reads the current unchecked step from `plan.md`, assembles a clipboard prompt with `@`-paths for only the files in that step. Warns if more than 6 paths are included. |
| **Add Plan Step** | Adds a new step to `plan.md` via a 3-field input (title, task, files). Auto-numbers the step. Opens the file at the new step. |
| **Prune Brain** | Removes duplicate bullets from `brain.md`. Also detects and offers to remove template placeholder lines. Shows exactly what will be removed before writing — nothing happens without confirmation. |
| **Promote Insight** | Promotes selected text (or typed text) into a specific `brain.md` section as a bullet. |
| **Merge Brain Updates** | Manually triggers a merge of `.agent/updates.md` into `brain.md`. Normally automatic — use this if the watcher didn't fire. |
| **Toggle Agent Mode** | Switches between Claude Code mode (`@`-paths in packets) and HITL mode (plain text for pasting into claude.ai). |
| **Repair Suggestions** | Runs health checks and shows a list of fixable issues with one-click fixes. |
| **Copy MCP Snippet** | Copies an MCP server registration JSON snippet to clipboard. |
| **Apply Hard Token Blocks** | Writes `permissions.deny` rules to `.claude/settings.json`. Blocks `node_modules/`, `dist/`, lock files, and other noise at the Claude Code process level — this is a harder block than `.claudeignore` which Claude can bypass if explicitly asked. |

---

## Automatic behaviors

- **On workspace open:** Checks for missing artifact files and offers to create them (configurable: prompt / silent / off)
- **On workspace open:** Checks for stale brain or interrupted session — copies a recovery prompt to clipboard if detected
- **On workspace open:** Checks for outdated managed files and offers to upgrade them non-destructively
- **On manifest change:** Auto-refreshes `project.md` when `package.json` or `pyproject.toml` is saved
- **On updates.md write:** Auto-merges brain updates within 3 seconds
- **Always:** CLAUDE.md linter warns in the Problems panel when the file exceeds line or token limits

---

## Limitations — read these before installing

- **Claude compliance is not guaranteed.** The write-back loop only works when Claude follows the instructions in `CLAUDE.md`. Claude sometimes skips the write-back step, especially in long sessions or after `/compact`. The extension detects this and warns you, but cannot fix it automatically.

- **`plan.md` is manual.** The extension reads `plan.md` to build prompt packets but does not generate or update task steps. You write the plan. Use Add Plan Step to append steps quickly.

- **Single-root workspaces only.** The extension always uses the first workspace folder. Multi-root workspaces are not supported.

- **No undo for upgrades.** When the extension upgrades managed files, it does so in place. Use git as your safety net — commit your artifacts before upgrading.

- **`.claudeignore` can be bypassed.** Claude can read ignored files if you explicitly ask it to. Use Apply Hard Token Blocks (`permissions.deny`) for paths you need to hard-block.

- **No Anthropic API integration.** The extension has no connection to Claude. Everything is file-based.

- **Primarily tested on Windows.** macOS and Linux should work but are less tested.

---

## Settings

All settings use the `tokenPilot.` prefix:

| Setting | Default | Description |
|---------|---------|-------------|
| `autoSetupMode` | `"prompt"` | `"prompt"` asks on open, `"trustedSilent"` auto-creates silently, `"off"` disables |
| `autoRefreshOnManifestChange` | `true` | Auto-refresh `project.md` when manifest changes |
| `claudeMdMaxLines` | `80` | Warn when `CLAUDE.md` exceeds this line count |
| `claudeMdMaxTokens` | `400` | Warn when `CLAUDE.md` estimated token count exceeds this |
| `brainMaxLines` | `200` | Warn and offer Prune when `brain.md` exceeds this line count |
| `includeBrainInPacket` | `true` | Include brain Status, Active Task, Pending, and Decisions in prompt packets |
| `agentMode` | `"claudeCode"` | `"claudeCode"` for `@`-path packets, `"hitl"` for plain-text claude.ai paste |
| `packetMaxAtPaths` | `6` | Warn when a packet includes more than this many `@`-paths |

---

## Installation

### From VSIX

1. Download the latest `venom-tokenpilot-X.Y.Z.vsix` from [Releases](https://github.com/vivek977/TokenPilot/releases)
2. In VS Code: Extensions (`Ctrl+Shift+X`) → `...` → **Install from VSIX...**
3. Select the file

### From source

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
- [Claude Code](https://claude.ai/code) — the brain loop and `@`-path features require Claude Code CLI or the VS Code extension

---

## License

MIT — see [LICENSE](LICENSE)

**Author:** venom | [https://github.com/vivek977/TokenPilot](https://github.com/vivek977/TokenPilot)
