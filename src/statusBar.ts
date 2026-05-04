// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { getAgentMode } from './agentModes/modeState';
import { readBrain, getLastUpdatedDate } from './brain/brainManager';
import { onBrainMerged } from './autoBootstrap/watcher';

export function registerStatusBar(context: vscode.ExtensionContext): void {
  // ── Mode item (existing) ──────────────────────────────────────────────────
  const modeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
  modeItem.command = 'tokenPilot.agentModeToggle';
  modeItem.tooltip = "Venom's Token Pilot mode — click to toggle";

  const updateMode = (): void => {
    const mode = getAgentMode();
    modeItem.text = mode === 'hitl'
      ? "$(person) Token Pilot: HITL"
      : "$(robot) Token Pilot: Claude Code";
    modeItem.show();
  };

  updateMode();

  // ── Brain freshness item (new) ────────────────────────────────────────────
  const brainItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  brainItem.command = 'tokenPilot.pruneBrain';
  brainItem.tooltip = "Brain last updated — click to prune";

  const updateBrainItem = (content: string | null): void => {
    if (!content) {
      brainItem.hide();
      return;
    }
    const lastDate = getLastUpdatedDate(content);
    brainItem.text = formatBrainAge(lastDate);
    brainItem.show();
  };

  // Load initial state from disk
  const folders = vscode.workspace.workspaceFolders;
  if (folders) {
    readBrain(folders[0].uri).then(updateBrainItem);
  }

  // Refresh whenever a merge completes (real-time, no extra disk read needed)
  const mergeListener = onBrainMerged.event(merged => updateBrainItem(merged));

  context.subscriptions.push(
    modeItem,
    brainItem,
    mergeListener,
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('tokenPilot.agentMode')) { updateMode(); }
    })
  );
}

/** Format a YYYY-MM-DD date stamp as a human-readable age label. */
function formatBrainAge(dateStr: string | null): string {
  if (!dateStr) { return "$(history) Brain: never"; }

  const today  = new Date();
  const stamp  = new Date(dateStr + 'T00:00:00');
  const diffMs = today.getTime() - stamp.getTime();
  const days   = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days === 0) { return "$(history) Brain: today"; }
  if (days === 1) { return "$(history) Brain: yesterday"; }
  if (days <= 7)  { return `$(history) Brain: ${days}d ago`; }
  return `$(warning) Brain: ${days}d ago`;  // warning icon if >1 week stale
}
