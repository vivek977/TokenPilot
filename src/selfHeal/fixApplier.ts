// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { CheckResult } from './checks';

const SEVERITY_ICON: Record<string, string> = {
  warning: '$(warning)',
  info:    '$(info)',
};

export async function showRepairChecklist(checks: CheckResult[]): Promise<void> {
  if (checks.length === 0) {
    vscode.window.showInformationMessage("Venom's Token Pilot: All checks passed — nothing to repair.");
    return;
  }

  const items = checks.map(c => ({
    label:       `${SEVERITY_ICON[c.severity]} ${c.label}`,
    description: c.fix ? '$(wrench) fix available' : 'manual fix required',
    detail:      c.message,
    check:       c,
    picked:      c.fix !== undefined && c.severity === 'warning',
  }));

  const selected = await vscode.window.showQuickPick(items, {
    canPickMany:         true,
    placeHolder:         `${checks.length} issue(s) found — select fixable items and press Enter to apply`,
    matchOnDescription:  true,
    matchOnDetail:       true,
  });

  if (!selected || selected.length === 0) { return; }

  const fixable = selected.filter(s => s.check.fix);
  if (fixable.length === 0) {
    vscode.window.showInformationMessage(
      "Venom's Token Pilot: Selected items have no automatic fix — resolve them manually."
    );
    return;
  }

  let applied = 0;
  for (const item of fixable) {
    try {
      await item.check.fix!.apply();
      applied++;
    } catch (err) {
      vscode.window.showErrorMessage(`Venom's Token Pilot: Fix failed for "${item.check.label}": ${String(err)}`);
    }
  }

  vscode.window.showInformationMessage(
    `Venom's Token Pilot: Applied ${applied} fix(es).`
  );
}
