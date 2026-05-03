// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { readBrain, writeBrain, lineCount, isOverCap } from '../brain/brainManager';
import { pruneBrain } from '../brain/pruner';
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

  const { pruned, removedCount } = pruneBrain(content);
  const before = lineCount(content);
  const after  = lineCount(pruned);

  if (removedCount === 0) {
    vscode.window.showInformationMessage(
      `Venom's Token Pilot: Brain is clean — no duplicates found. (${before} lines)`
    );
    return;
  }

  const answer = await vscode.window.showInformationMessage(
    `Venom's Token Pilot: Found ${removedCount} duplicate line(s). Prune now? (${before} → ${after} lines)`,
    'Prune', 'Cancel'
  );

  if (answer !== 'Prune') { return; }

  await writeBrain(root, pruned);

  const cfg      = getConfig();
  const stillOver = after > cfg.brainMaxLines;
  const suffix   = stillOver
    ? ` Still over cap (${after}/${cfg.brainMaxLines}) — trim manually.`
    : '';

  vscode.window.showInformationMessage(
    `Venom's Token Pilot: Removed ${removedCount} duplicate(s). Brain is now ${after} lines.${suffix}`
  );
}
