// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { readIfExists } from '../fileUtils';

export function registerAddPlanStep(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.addPlanStep', () => runAddPlanStep())
  );
}

async function runAddPlanStep(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    vscode.window.showWarningMessage("Venom's Token Pilot: No workspace folder open.");
    return;
  }

  const root    = folders[0].uri;
  const planUri = vscode.Uri.joinPath(root, 'plan.md');

  const existing = await readIfExists(planUri);
  if (!existing) {
    vscode.window.showWarningMessage(
      "Venom's Token Pilot: plan.md not found. Run Initialize Project first."
    );
    return;
  }

  // ── Step 1: title ──────────────────────────────────────────────────────────
  const title = await vscode.window.showInputBox({
    title:       "New Plan Step — Title",
    prompt:      "Short title for this step (e.g. 'Wire auth middleware')",
    placeHolder: "Step title",
    ignoreFocusOut: true,
  });
  if (!title) { return; } // cancelled

  // ── Step 2: task description ───────────────────────────────────────────────
  const task = await vscode.window.showInputBox({
    title:       "New Plan Step — Task",
    prompt:      "What needs to be done? (one line, becomes a checkbox)",
    placeHolder: "Describe the task",
    ignoreFocusOut: true,
  });
  if (!task) { return; }

  // ── Step 3: files in scope ─────────────────────────────────────────────────
  const filesInput = await vscode.window.showInputBox({
    title:       "New Plan Step — Files",
    prompt:      "Files in scope — comma-separated paths (e.g. src/auth.ts, src/middleware.ts)",
    placeHolder: "path/to/file.ts, path/to/other.ts",
    ignoreFocusOut: true,
  });
  if (filesInput === undefined) { return; } // cancelled — empty string is OK (no files)

  // ── Build the step block ───────────────────────────────────────────────────
  const nextIndex = countExistingSteps(existing) + 1;
  const filesLine = filesInput.trim()
    ? `- **Files:** ${filesInput.trim().split(',').map(f => `\`${f.trim()}\``).join(', ')}`
    : `- **Files:** (add files here)`;

  const stepBlock = [
    '',
    `### Step ${nextIndex} — ${title}`,
    '',
    `- [ ] ${task}`,
    filesLine,
    `- **Notes:** (add notes here)`,
  ].join('\n');

  // ── Insert before ## Constraints (or append before Session Log) ────────────
  const updated = insertStepBlock(existing, stepBlock);

  await vscode.workspace.fs.writeFile(planUri, Buffer.from(updated, 'utf8'));

  // Open plan.md and jump to the new step
  const doc = await vscode.workspace.openTextDocument(planUri);
  const editor = await vscode.window.showTextDocument(doc);

  // Move cursor to the new step heading
  const stepHeading = `### Step ${nextIndex} — ${title}`;
  const lineIdx = doc.getText().split('\n').findIndex(l => l === stepHeading);
  if (lineIdx !== -1) {
    const pos = new vscode.Position(lineIdx, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }

  vscode.window.showInformationMessage(
    `Venom's Token Pilot: Step ${nextIndex} "${title}" added to plan.md.`
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Count existing ### Step N headings to determine the next index. */
function countExistingSteps(content: string): number {
  const matches = content.match(/^###\s+Step\s+\d+/gim);
  return matches ? matches.length : 0;
}

/**
 * Insert the step block just before ## Constraints.
 * Falls back to inserting before ## Session Log.
 * Falls back to appending at end of file.
 */
function insertStepBlock(content: string, block: string): string {
  // Try to insert before ## Constraints
  const constraintsIdx = content.indexOf('\n## Constraints');
  if (constraintsIdx !== -1) {
    return content.slice(0, constraintsIdx) + block + content.slice(constraintsIdx);
  }

  // Try to insert before ## Session Log
  const logIdx = content.indexOf('\n## Session Log');
  if (logIdx !== -1) {
    return content.slice(0, logIdx) + block + content.slice(logIdx);
  }

  // Fallback: append
  return content.trimEnd() + block + '\n';
}
