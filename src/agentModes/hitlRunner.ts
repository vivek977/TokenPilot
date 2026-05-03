// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { readIfExists } from '../fileUtils';
import { parseCurrentStep } from '../packet/planReader';

/**
 * Mark all unchecked tasks in the current plan.md step as done.
 * Returns true if any tasks were marked.
 */
export async function markCurrentStepDone(root: vscode.Uri): Promise<boolean> {
  const uri     = vscode.Uri.joinPath(root, 'plan.md');
  const content = await readIfExists(uri);
  if (!content) { return false; }

  const step = parseCurrentStep(content);
  if (!step) { return false; }

  const updated = markStepTasksDone(content, step.stepIndex);
  if (updated === content) { return false; }

  await vscode.workspace.fs.writeFile(uri, Buffer.from(updated, 'utf8'));
  return true;
}

/**
 * Replace `- [ ]` with `- [x]` for all tasks inside the Nth step section.
 */
function markStepTasksDone(content: string, stepIndex: number): string {
  const lines  = content.split('\n');
  const result = [...lines];

  let currentStep = 0;
  let inTargetStep = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^###\s+Step\s+\d+/i.test(line)) {
      currentStep++;
      inTargetStep = currentStep === stepIndex;
      continue;
    }

    // Stop when next ## heading (not ###) is reached
    if (/^##\s/.test(line) && !/^###/.test(line)) {
      inTargetStep = false;
      continue;
    }

    if (inTargetStep && /^\s*-\s+\[ \]/.test(line)) {
      result[i] = line.replace(/^(\s*-\s+)\[ \]/, '$1[x]');
    }
  }

  return result.join('\n');
}
