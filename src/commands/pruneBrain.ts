// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { readBrain, writeBrain, lineCount, isOverCap } from '../brain/brainManager';
import { pruneBrain, removePlaceholders } from '../brain/pruner';
import { getConfig } from '../config';

export function registerPruneBrain(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.pruneBrain', () => runPruneBrain())
  );
}

export async function runPruneBrain(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    vscode.window.showWarningMessage("Venom's Token Pilot: No workspace folder open.");
    return;
  }

  const root    = folders[0].uri;
  const content = await readBrain(root);

  if (!content) {
    vscode.window.showWarningMessage("Venom's Token Pilot: .agent/brain.md not found. Run Initialize Project first.");
    return;
  }

  const { pruned, removedCount, placeholderCount, placeholderLines } = pruneBrain(content);
  const before = lineCount(content);
  const cfg    = getConfig();
  let working  = pruned;
  let totalRemoved = removedCount;

  // ── Phase 1: duplicates ───────────────────────────────────────────────────
  if (removedCount > 0) {
    const after = lineCount(pruned);
    const answer = await vscode.window.showInformationMessage(
      `Venom's Token Pilot: Found ${removedCount} duplicate line(s). Prune now? (${before} → ${after} lines)`,
      'Prune', 'Skip', 'Cancel'
    );
    if (answer === 'Cancel') { return; }
    if (answer === 'Prune') {
      await writeBrain(root, pruned);
    } else {
      working = content; // user skipped dedup — carry original into phase 2
      totalRemoved = 0;
    }
  }

  // ── Phase 2: placeholders ─────────────────────────────────────────────────
  if (placeholderCount > 0) {
    const preview = placeholderLines.map(l => `  ${l.trim()}`).join('\n');
    const answer2 = await vscode.window.showInformationMessage(
      `Venom's Token Pilot: Found ${placeholderCount} template placeholder line(s) in brain.md. Remove them?\n\n${preview}`,
      'Remove', 'Cancel'
    );
    if (answer2 === 'Remove') {
      const { result: cleaned, count } = removePlaceholders(working);
      await writeBrain(root, cleaned);
      totalRemoved += count;
      working = cleaned;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  if (removedCount === 0 && placeholderCount === 0) {
    vscode.window.showInformationMessage(
      `Venom's Token Pilot: Brain is clean — no duplicates or placeholders found. (${before} lines)`
    );
    return;
  }

  if (totalRemoved > 0) {
    const finalLines = lineCount(working);
    const stillOver  = finalLines > cfg.brainMaxLines;
    const suffix     = stillOver ? ` Still over cap (${finalLines}/${cfg.brainMaxLines}) — trim manually.` : '';
    vscode.window.showInformationMessage(
      `Venom's Token Pilot: Removed ${totalRemoved} line(s). Brain is now ${finalLines} lines.${suffix}`
    );
  }
}
