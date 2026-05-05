// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import * as path from 'path';
import { readBrain, getLastUpdatedDate } from '../brain/brainManager';
import { getLastCommitDate } from '../gitUtils';

/**
 * On workspace open, compare brain.md's newest date stamp against the last
 * git commit date. If the brain is stale (commits happened after the last
 * brain update) or a session was interrupted (Active Task is not "(none)"),
 * copy a pre-filled recovery prompt to the clipboard and notify the user.
 */
export async function runSessionRecoveryCheck(root: vscode.Uri): Promise<void> {
  const brainContent = await readBrain(root);
  if (!brainContent) { return; } // no brain.md yet — init will handle it

  const lastCommit = getLastCommitDate(root.fsPath);
  const lastBrain  = getLastUpdatedDate(brainContent);
  const interrupted = extractActiveTask(brainContent);

  const brainStale   = isBrainStale(lastBrain, lastCommit);
  const wasInterrupted = interrupted !== null && interrupted !== '(none)';

  if (!brainStale && !wasInterrupted) { return; }

  // Build the recovery prompt
  const date   = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`<!-- Venom's Token Pilot: Session Recovery — ${date} -->`);
  lines.push('');
  lines.push('DO THIS BEFORE ANYTHING ELSE. Do not start any task until these steps are complete.');
  lines.push('');

  let stepNum = 1;

  // ── Always: read the files first ─────────────────────────────────────────
  lines.push(`**Step ${stepNum++}: Read these files in order**`);
  lines.push('1. Read `project.md` — understand the stack and entry points');
  lines.push('2. Read `.agent/brain.md` — understand current Status, Decisions, Gotchas');
  lines.push('3. Read `plan.md` — understand the current goal and active step');
  lines.push('');

  // ── Interrupted session ───────────────────────────────────────────────────
  if (wasInterrupted) {
    lines.push(`**Step ${stepNum++}: Interrupted session — resume or close it**`);
    lines.push('');
    lines.push(`The previous session ended without clearing Active Task. It was:`);
    lines.push(`> ${interrupted}`);
    lines.push('');
    lines.push('You have two choices:');
    lines.push('- **Resume it** — continue that task now');
    lines.push('- **Close it** — if it was already finished or no longer relevant, append this to `.agent/updates.md` exactly:');
    lines.push('');
    lines.push('```');
    lines.push('---UPDATE---');
    lines.push('target: Active Task');
    lines.push(`date: ${date}`);
    lines.push('- (none)');
    lines.push('---END---');
    lines.push('```');
    lines.push('');
    lines.push('The extension will auto-merge this within 3 seconds. Do not edit brain.md directly.');
    lines.push('');
  }

  // ── Stale brain ───────────────────────────────────────────────────────────
  if (brainStale) {
    lines.push(`**Step ${stepNum++}: Update brain Status — it is out of date**`);
    lines.push('');
    lines.push(
      lastBrain
        ? `brain.md Status was last written on ${lastBrain}. Git has commits after that date meaning work happened that Claude never recorded.`
        : `brain.md has never been updated by Claude. It shows the initial state only.`
    );
    lines.push('');
    lines.push('After reading the files in Step 1:');
    lines.push('');
    lines.push('1. Write one sentence describing the actual current state of this codebase.');
    lines.push('   What is working? What is broken? What is half-done?');
    lines.push('   Do NOT copy a template. Write a real sentence based on what you just read.');
    lines.push('');
    lines.push('2. Then append to `.agent/updates.md` using this exact format,');
    lines.push('   replacing YOUR_SENTENCE with the sentence you just wrote:');
    lines.push('');
    lines.push('```');
    lines.push('---UPDATE---');
    lines.push('target: Status');
    lines.push(`date: ${date}`);
    lines.push('- YOUR_SENTENCE');
    lines.push('---END---');
    lines.push('```');
    lines.push('');
    lines.push('The extension auto-merges within 3 seconds. Do not edit brain.md directly.');
    lines.push('');
  }

  lines.push(`**Step ${stepNum}: Confirm brain is current, then start your task**`);
  lines.push('Check the VS Code status bar — it should show `Brain: today` after the merge.');
  lines.push('Only then proceed with new work.');

  const prompt = lines.join('\n');

  // Copy to clipboard and notify
  await vscode.env.clipboard.writeText(prompt);

  const label = wasInterrupted && brainStale
    ? 'Interrupted session + stale brain detected'
    : wasInterrupted
      ? 'Interrupted session detected'
      : 'Brain is stale — commits since last update';

  const answer = await vscode.window.showWarningMessage(
    `Venom's Token Pilot: ${label}. Recovery prompt copied to clipboard — paste it first.`,
    'Show Details',
    'Dismiss'
  );

  if (answer === 'Show Details') {
    const doc = await vscode.workspace.openTextDocument({
      content: prompt,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the Active Task body line from brain.md.
 * Returns null if section not found, "(none)" if explicitly cleared.
 */
function extractActiveTask(brain: string): string | null {
  const lines   = brain.split('\n');
  const headIdx = lines.findIndex(l => l.trim() === '## Active Task');
  if (headIdx === -1) { return null; }

  for (let i = headIdx + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^##\s/.test(l)) { break; }          // next section
    if (l.startsWith('<!--')) { continue; }   // skip comments
    if (l.startsWith('-')) {
      // Strip leading `- ` and date stamp comment
      return l.replace(/^-\s*/, '').replace(/<!--.*-->/, '').trim();
    }
  }
  return null;
}

/**
 * Returns true if git has commits that post-date the last brain update,
 * meaning Claude likely worked on the project without writing back.
 */
function isBrainStale(lastBrain: string | null, lastCommit: string | null): boolean {
  if (!lastCommit) { return false; } // not a git repo — can't tell
  if (!lastBrain)  { return true;  } // brain has never been updated

  // String comparison works for YYYY-MM-DD (lexicographic = chronological)
  return lastCommit > lastBrain;
}
