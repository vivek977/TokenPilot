// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { runRefreshMap } from '../commands/refreshMap';
import { getConfig } from '../config';
import { readBrain, writeBrain, isOverCap, lineCount, updatesUri, insertAfterHeading, replaceSection } from '../brain/brainManager';
import { readIfExists } from '../fileUtils';
import { parseUpdates, applyUpdatesToBrain, truncateUpdates } from '../brain/updatesMerger';

export function registerManifestWatcher(context: vscode.ExtensionContext): void {
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/{package.json,pyproject.toml}'
  );

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const onManifestChange = (uri: vscode.Uri): void => {
    if (!getConfig().autoRefreshOnManifestChange) { return; }
    if (!isRootManifest(uri)) { return; }

    if (debounceTimer) { clearTimeout(debounceTimer); }
    debounceTimer = setTimeout(() => runRefreshMap(true), 2000);
  };

  context.subscriptions.push(
    watcher,
    watcher.onDidChange(onManifestChange),
    watcher.onDidCreate(onManifestChange),
  );
}

export function registerBrainCapWatcher(context: vscode.ExtensionContext): void {
  const watcher = vscode.workspace.createFileSystemWatcher('**/.agent/brain.md');

  const onBrainChange = async (): Promise<void> => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) { return; }

    const content = await readBrain(folders[0].uri);
    if (!content || !isOverCap(content)) { return; }

    const cfg = getConfig();
    const answer = await vscode.window.showWarningMessage(
      `Venom's Token Pilot: brain.md is ${lineCount(content)} lines (cap: ${cfg.brainMaxLines}). Prune now?`,
      'Prune Brain', 'Dismiss'
    );
    if (answer === 'Prune Brain') {
      vscode.commands.executeCommand('tokenPilot.pruneBrain');
    }
  };

  context.subscriptions.push(
    watcher,
    watcher.onDidChange(onBrainChange),
    watcher.onDidCreate(onBrainChange),
  );
}

export function registerMergeUpdatesCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.mergeUpdates', () => runUpdatesMerge())
  );
}

export function registerUpdatesWatcher(context: vscode.ExtensionContext): void {
  const watcher = vscode.workspace.createFileSystemWatcher('**/.agent/updates.md');

  let mergeTimer: ReturnType<typeof setTimeout> | undefined;

  const onUpdatesChange = (): void => {
    if (mergeTimer) { clearTimeout(mergeTimer); }
    mergeTimer = setTimeout(() => runUpdatesMerge(), 3000);
  };

  context.subscriptions.push(
    watcher,
    watcher.onDidChange(onUpdatesChange),
    watcher.onDidCreate(onUpdatesChange),
  );
}

async function runUpdatesMerge(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) { return; }

  const root        = folders[0].uri;
  const updatesText = await readIfExists(updatesUri(root));
  if (!updatesText?.includes('---UPDATE---')) { return; }

  const brainText = await readBrain(root);
  if (!brainText) { return; }

  const updates = parseUpdates(updatesText);
  if (updates.length === 0) { return; }

  // Warn if updates.md is suspiciously large before merging
  if (updatesText.split('\n').length > 500) {
    vscode.window.showWarningMessage(
      `Venom's Token Pilot: updates.md has ${updatesText.split('\n').length} lines — Claude may be writing too much. Merging anyway.`
    );
  }

  const merged = applyUpdatesToBrain(brainText, updates, insertAfterHeading, replaceSection);
  await writeBrain(root, merged);

  const cleared = truncateUpdates();
  await vscode.workspace.fs.writeFile(updatesUri(root), Buffer.from(cleared, 'utf8'));

  if (isOverCap(merged)) {
    const cfg = getConfig();
    const answer = await vscode.window.showWarningMessage(
      `Venom's Token Pilot: brain.md merged ${updates.length} update(s) but is over cap (${lineCount(merged)}/${cfg.brainMaxLines}). Prune now?`,
      'Prune Brain'
    );
    if (answer === 'Prune Brain') {
      vscode.commands.executeCommand('tokenPilot.pruneBrain');
    }
  }
}

function isRootManifest(uri: vscode.Uri): boolean {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) { return false; }

  const root    = folders[0].uri;
  const pkgUri  = vscode.Uri.joinPath(root, 'package.json');
  const pyUri   = vscode.Uri.joinPath(root, 'pyproject.toml');

  return uri.fsPath === pkgUri.fsPath || uri.fsPath === pyUri.fsPath;
}
