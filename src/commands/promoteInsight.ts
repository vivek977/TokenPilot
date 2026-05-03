// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { readBrain, writeBrain, insertAfterHeading, isOverCap } from '../brain/brainManager';

const SECTIONS = ['Decisions', 'Gotchas', 'Do-Not-Repeat', 'Promoted Insights'];

export function registerPromoteInsight(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.promoteInsight', () => runPromoteInsight())
  );
}

async function runPromoteInsight(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) { return; }

  const root    = folders[0].uri;
  const content = await readBrain(root);

  if (!content) {
    vscode.window.showWarningMessage("Venom's Token Pilot: .agent/brain.md not found. Run Initialize Project first.");
    return;
  }

  const sectionPick = await vscode.window.showQuickPick(
    SECTIONS.map(label => ({ label })),
    { placeHolder: 'Which section should this insight go into?' }
  );
  if (!sectionPick) { return; }

  const insight = await vscode.window.showInputBox({
    prompt:      'Enter the insight (one bullet — be concise)',
    placeHolder: 'e.g. Always use X instead of Y because...',
  });
  if (!insight?.trim()) { return; }

  const date    = new Date().toISOString().slice(0, 10);
  const bullet  = `- ${insight.trim()} <!-- date: ${date} -->`;
  const heading = `## ${sectionPick.label}`;
  const updated = insertAfterHeading(content, heading, bullet);

  await writeBrain(root, updated);

  if (isOverCap(updated)) {
    vscode.window.showWarningMessage(
      `Venom's Token Pilot: Insight added to ${sectionPick.label}, but brain.md is over cap — run Prune Brain.`
    );
  } else {
    vscode.window.showInformationMessage(
      `Venom's Token Pilot: Insight added to ${sectionPick.label}.`
    );
  }
}
