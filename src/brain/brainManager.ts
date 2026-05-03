import * as vscode from 'vscode';
import { readIfExists } from '../fileUtils';
import { getConfig } from '../config';

export function brainUri(root: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(root, '.agent', 'brain.md');
}

export function updatesUri(root: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(root, '.agent', 'updates.md');
}

/** Replace the body of a ## Section (preserves comment lines after heading, stops at next ## or EOF). */
export function replaceSection(content: string, heading: string, newBody: string): string {
  const lines = content.split('\n');
  const headingIdx = lines.findIndex(l => l.trim() === heading);

  if (headingIdx === -1) {
    return content.trimEnd() + '\n\n' + heading + '\n\n' + newBody + '\n';
  }

  let contentStart = headingIdx + 1;
  while (contentStart < lines.length && lines[contentStart].trim().startsWith('<!--')) {
    contentStart++;
  }

  let sectionEnd = contentStart;
  while (sectionEnd < lines.length && !/^##\s/.test(lines[sectionEnd])) {
    sectionEnd++;
  }

  return [
    ...lines.slice(0, contentStart),
    ...newBody.split('\n'),
    '',
    ...lines.slice(sectionEnd),
  ].join('\n');
}

export async function readBrain(root: vscode.Uri): Promise<string | null> {
  return readIfExists(brainUri(root));
}

export async function writeBrain(root: vscode.Uri, content: string): Promise<void> {
  await vscode.workspace.fs.writeFile(brainUri(root), Buffer.from(content, 'utf8'));
}

export function lineCount(content: string): number {
  return content.split('\n').length;
}

export function isOverCap(content: string): boolean {
  return lineCount(content) > getConfig().brainMaxLines;
}

/** Insert bullet after a section heading, respecting the fixed-section structure. */
export function insertAfterHeading(content: string, heading: string, bullet: string): string {
  const lines = content.split('\n');
  const idx   = lines.findIndex(l => l.trim() === heading);

  if (idx === -1) {
    return content.trimEnd() + '\n\n' + bullet + '\n';
  }

  // Skip comment lines immediately after the heading
  let insertAt = idx + 1;
  while (insertAt < lines.length && lines[insertAt].trim().startsWith('<!--')) {
    insertAt++;
  }

  lines.splice(insertAt, 0, bullet);
  return lines.join('\n');
}
