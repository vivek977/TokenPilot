// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Hard deny patterns — these bypass .claudeignore so must be in settings.json
const DENY_GLOB_PATTERNS = [
  'node_modules/**',
  'dist/**',
  'out/**',
  'build/**',
  '.next/**',
  '__pycache__/**',
  '*.vsix',
  '*.tsbuildinfo',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'poetry.lock',
  '*.log',
  '.git/**',
];

export function registerCopyPermissionsDeny(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.copyPermissionsDeny', () => runCopyPermissionsDeny())
  );
}

async function runCopyPermissionsDeny(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  const root = folders?.[0]?.uri.fsPath;

  // Check if a .claude/settings.json already exists in the workspace
  const settingsPath = root ? path.join(root, '.claude', 'settings.json') : null;
  const settingsExist = settingsPath ? fs.existsSync(settingsPath) : false;

  const choices: vscode.QuickPickItem[] = [
    {
      label: '$(files) Copy snippet (manual paste)',
      description: 'Copy the permissions.deny block — paste into .claude/settings.json yourself',
      detail: 'Safe — you control where it goes',
    },
  ];

  if (settingsPath && settingsExist) {
    choices.push({
      label: '$(edit) Merge into existing .claude/settings.json',
      description: settingsPath,
      detail: 'Adds deny rules without overwriting other settings',
    });
  } else if (settingsPath) {
    choices.push({
      label: '$(new-file) Create .claude/settings.json with deny rules',
      description: settingsPath,
      detail: 'Creates the file — no existing settings to preserve',
    });
  }

  const pick = await vscode.window.showQuickPick(choices, {
    title: "Token Pilot: Hard-block noisy paths",
    placeHolder: 'Choose an action',
    ignoreFocusOut: true,
  });
  if (!pick) { return; }

  const denyBlock = { permissions: { deny: DENY_GLOB_PATTERNS } };

  if (pick.label.includes('Copy snippet')) {
    const snippet = JSON.stringify(denyBlock, null, 2);
    await vscode.env.clipboard.writeText(snippet);
    vscode.window.showInformationMessage(
      "Venom's Token Pilot: Deny rules copied. Paste into .claude/settings.json under \"permissions\"."
    );
    return;
  }

  // Write or merge into .claude/settings.json
  if (!settingsPath) { return; }

  try {
    await ensureClaudeDir(path.dirname(settingsPath));

    let merged: Record<string, unknown>;
    if (settingsExist) {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      let existing: Record<string, unknown> = {};
      try { existing = JSON.parse(raw); } catch { existing = {}; }

      // Merge deny list — deduplicate
      const existingDeny: string[] = ((existing as Record<string, Record<string, unknown>>).permissions?.deny as string[]) ?? [];
      const combined = Array.from(new Set([...existingDeny, ...DENY_GLOB_PATTERNS]));
      merged = {
        ...existing,
        permissions: {
          ...((existing as Record<string, Record<string, unknown>>).permissions ?? {}),
          deny: combined,
        },
      };
    } else {
      merged = denyBlock;
    }

    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');

    const doc = await vscode.workspace.openTextDocument(settingsPath);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(
      `Venom's Token Pilot: ${DENY_GLOB_PATTERNS.length} deny rules written to .claude/settings.json. Claude cannot read these paths even if explicitly asked.`
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Venom's Token Pilot: Failed to write settings — ${String(err)}`);
  }
}

function ensureClaudeDir(dirPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdir(dirPath, { recursive: true }, (err) => {
      if (err) { reject(err); } else { resolve(); }
    });
  });
}
