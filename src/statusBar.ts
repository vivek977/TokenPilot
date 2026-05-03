// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { getAgentMode } from './agentModes/modeState';

export function registerStatusBar(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'tokenPilot.agentModeToggle';
  item.tooltip = "Venom's Token Pilot mode — click to toggle";

  const update = (): void => {
    const mode = getAgentMode();
    item.text = mode === 'hitl'
      ? "$(person) Token Pilot: HITL"
      : "$(robot) Token Pilot: Claude Code";
    item.show();
  };

  update();

  // Refresh when configuration changes
  context.subscriptions.push(
    item,
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('tokenPilot.agentMode')) { update(); }
    })
  );
}
