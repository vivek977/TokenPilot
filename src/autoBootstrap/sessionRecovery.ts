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

  if (wasInterrupted) {
    lines.push('## Interrupted Session Detected');
    lines.push('');
    lines.push(`The previous session was interrupted. Active Task was:`);
    lines.push(`> ${interrupted}`);
    lines.push('');
    lines.push('Before starting new work:');
    lines.push('1. Read `.agent/brain.md` — check what was in progress');
    lines.push('2. Either resume the interrupted task or append to `.agent/updates.md`:');
    lines.push('```');
    lines.push('---UPDATE---');
    lines.push('target: Active Task');
    lines.push(`date: ${date}`);
    lines.push('- (none)');
    lines.push('---END---');
    lines.push('```');
  }

  if (brainStale) {
    if (wasInterrupted) { lines.push(''); }
    lines.push('## Brain is Stale');
    lines.push('');
    lines.push(
      lastBrain
        ? `brain.md was last updated ${lastBrain} but git has commits since then.`
        : `brain.md has no date stamps — it has never been updated by Claude.`
    );
    lines.push('');
    lines.push('Before starting new work:');
    lines.push('1. Read `.agent/brain.md` — review current Status and Decisions');
    lines.push('2. Update Status to reflect the actual current codebase state:');
    lines.push('```');
    lines.push('---UPDATE---');
    lines.push('target: Status');
    lines.push(`date: ${date}`);
    lines.push('(one sentence: what is working, what is broken, what is half-done)');
    lines.push('---END---');
    lines.push('```');
  }

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
