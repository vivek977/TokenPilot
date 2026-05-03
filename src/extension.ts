import * as vscode from 'vscode';
import { registerInitProject, runInit } from './commands/initProject';
import { registerRefreshMap } from './commands/refreshMap';
import { registerBuildPacket } from './commands/buildPacket';
import { registerPruneBrain } from './commands/pruneBrain';
import { registerPromoteInsight } from './commands/promoteInsight';
import { registerRepairSuggestions } from './commands/repairSuggestions';
import { registerAgentModeToggle } from './commands/agentModeToggle';
import { registerCopyMcpSnippet } from './commands/copyMcpSnippet';
import { readIfExists } from './fileUtils';
import { registerClaudeMdLinter } from './lint/claudeMdLinter';
import { registerStatusBar } from './statusBar';
import { registerManifestWatcher, registerBrainCapWatcher, registerUpdatesWatcher, registerMergeUpdatesCommand } from './autoBootstrap/watcher';
import { runUpgradeCheck } from './autoBootstrap/upgrader';
import { runRefreshMap } from './commands/refreshMap';
import { getConfig } from './config';

export function activate(context: vscode.ExtensionContext): void {
  registerInitProject(context);
  registerRefreshMap(context);
  registerBuildPacket(context);
  registerPruneBrain(context);
  registerPromoteInsight(context);
  registerRepairSuggestions(context);
  registerAgentModeToggle(context);
  registerCopyMcpSnippet(context);
  registerClaudeMdLinter(context);
  registerManifestWatcher(context);
  registerBrainCapWatcher(context);
  registerUpdatesWatcher(context);
  registerMergeUpdatesCommand(context);
  registerStatusBar(context);

  // Auto-bootstrap: check for missing artifacts on workspace open
  scheduleBootstrapCheck(context);

  // Re-check when workspace folders change (new folder added)
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => scheduleBootstrapCheck(context))
  );
}

export function deactivate(): void {
  // nothing to clean up
}

let bootstrapTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleBootstrapCheck(context: vscode.ExtensionContext): void {
  if (bootstrapTimer) { clearTimeout(bootstrapTimer); }
  // Debounce 1.5s so VS Code finishes loading before we prompt
  bootstrapTimer = setTimeout(() => runBootstrapCheck(context), 1500);
}

async function runBootstrapCheck(context: vscode.ExtensionContext): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) { return; }

  const root = folders[0].uri;
  const cfg = getConfig();
  if (cfg.autoSetupMode === 'off') { return; }

  // Check for outdated managed files and offer to upgrade
  const extVersion: string = context.extension.packageJSON.version as string;
  await runUpgradeCheck(context, root, extVersion);

  // Check which core artifacts are missing
  const missing: string[] = [];
  const checks: [string, string][] = [
    ['CLAUDE.md', 'CLAUDE.md'],
    ['project.md', 'project.md'],
    ['plan.md', 'plan.md'],
    ['.claudeignore', '.claudeignore'],
    ['.agent/brain.md', '.agent/brain.md'],
  ];

  for (const [label, rel] of checks) {
    const parts = rel.split('/');
    const uri = vscode.Uri.joinPath(root, ...parts);
    const content = await readIfExists(uri);
    if (content === null) { missing.push(label); }
  }

  if (missing.length === 0) {
    // All artifacts present — silently sync project.md from manifest
    await runRefreshMap(true);
    return;
  }

  if (cfg.autoSetupMode === 'trustedSilent' && vscode.workspace.isTrusted) {
    await runInit(context, true);
    return;
  }

  // prompt mode
  const answer = await vscode.window.showInformationMessage(
    `Venom's Token Pilot: ${missing.length} artifact(s) missing (${missing.join(', ')}). Initialize now?`,
    'Initialize',
    'Skip'
  );
  if (answer === 'Initialize') {
    await runInit(context, false);
  }
}
