// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';

/**
 * Write content to uri only if the file does not already exist (overwrite=false)
 * or if explicitly allowed (overwrite=true). Returns true if written, false if skipped.
 */
export async function safeWrite(
  uri: vscode.Uri,
  content: string,
  overwrite = false
): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    if (!overwrite) {
      return false;
    }
  } catch {
    // file does not exist — safe to write
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
  return true;
}

export async function readIfExists(uri: vscode.Uri): Promise<string | null> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}

export async function ensureDir(uri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.createDirectory(uri);
}

/** Replace {{KEY}} tokens in a template string with values from vars map. */
export function applyTokens(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
