// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as vscode from 'vscode';
import { readIfExists } from '../fileUtils';
import { parsePackageJson, parsePyprojectToml, ManifestInfo } from '../scanner/manifestParser';
import { listTopLevelEntries } from '../scanner/dirTree';
import { buildProjectMap } from '../scanner/projectMapBuilder';
import { readGitignorePatterns } from '../gitUtils';

const MAP_START = '<!-- PROJECT_MAP_START -->';
const MAP_END   = '<!-- PROJECT_MAP_END -->';

function detectFramework(info: ManifestInfo): string {
  const deps = [...info.depNames, ...info.devDepNames];
  if (deps.includes('next'))           { return 'Next.js'; }
  if (deps.includes('react'))          { return 'React'; }
  if (deps.includes('vue'))            { return 'Vue'; }
  if (deps.includes('@angular/core'))  { return 'Angular'; }
  if (deps.includes('express'))        { return 'Express'; }
  if (deps.includes('fastapi'))        { return 'FastAPI'; }
  if (deps.includes('django'))         { return 'Django'; }
  if (deps.includes('flask'))          { return 'Flask'; }
  return info.lang === 'node' ? 'Node.js' : info.lang === 'python' ? 'Python' : 'Unknown';
}

// Replace a ## Section block (from heading to next ## heading or PROJECT_MAP marker)
// Preserves ## USER: sections by stopping before them
function replaceSection(content: string, heading: string, newBody: string): string {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => l.trim() === heading);
  if (startIdx === -1) { return content; }

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ') || lines[i].startsWith('<!-- PROJECT_MAP')) {
      endIdx = i;
      break;
    }
  }

  const replacement = [heading, '', ...newBody.split('\n'), ''];
  return [...lines.slice(0, startIdx), ...replacement, ...lines.slice(endIdx)].join('\n');
}

function buildStaticSections(info: ManifestInfo): { stack: string; entries: string; scripts: string } {
  const langLabel = info.lang === 'node' ? 'TypeScript / JavaScript' : info.lang === 'python' ? 'Python' : 'Unknown';
  const pkgMgr    = info.lang === 'node' ? 'npm' : 'pip / poetry';
  const stack     = `- **Language:** ${langLabel}\n- **Runtime/Framework:** ${detectFramework(info)}\n- **Package manager:** ${pkgMgr}`;
  const entries   = info.entryPoints.length > 0
    ? info.entryPoints.map(e => `- \`${e}\``).join('\n')
    : '- (see manifest)';
  const scripts   = Object.entries(info.scripts).length > 0
    ? Object.entries(info.scripts).slice(0, 8).map(([k, v]) => `- \`${k}\`${v ? ': ' + v : ''}`).join('\n')
    : '- (none defined)';
  return { stack, entries, scripts };
}

export function registerRefreshMap(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.refreshMap', () => runRefreshMap())
  );
}


export async function runRefreshMap(silent = false): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    if (!silent) { vscode.window.showWarningMessage("Venom's Token Pilot: No workspace folder open."); }
    return;
  }

  const root     = folders[0].uri;
  const rootPath = root.fsPath;

  // Detect manifest — prefer package.json, fall back to pyproject.toml
  const pkgText = await readIfExists(vscode.Uri.joinPath(root, 'package.json'));
  const pyText  = await readIfExists(vscode.Uri.joinPath(root, 'pyproject.toml'));

  let manifestInfo;
  if (pkgText) {
    try { manifestInfo = parsePackageJson(pkgText); }
    catch { if (!silent) { vscode.window.showWarningMessage("Venom's Token Pilot: Could not parse package.json."); } return; }
  } else if (pyText) {
    manifestInfo = parsePyprojectToml(pyText);
  } else {
    if (!silent) { vscode.window.showWarningMessage("Venom's Token Pilot: No package.json or pyproject.toml found."); }
    return;
  }

  const ignorePatterns = readGitignorePatterns(rootPath);
  const dirEntries     = listTopLevelEntries(rootPath, ignorePatterns);
  const newMap         = buildProjectMap(manifestInfo, dirEntries);

  // Update project.md between the marker comments
  const projectMdUri = vscode.Uri.joinPath(root, 'project.md');
  const content      = await readIfExists(projectMdUri);

  if (!content) {
    if (!silent) { vscode.window.showWarningMessage("Venom's Token Pilot: project.md not found. Run Initialize Project first."); }
    return;
  }

  const startIdx = content.indexOf(MAP_START);
  const endIdx   = content.indexOf(MAP_END);

  if (startIdx === -1 || endIdx === -1) {
    if (!silent) { vscode.window.showWarningMessage("Venom's Token Pilot: project.md is missing PROJECT_MAP markers."); }
    return;
  }

  // Update PROJECT_MAP block
  let updated = content.slice(0, startIdx)
    + MAP_START + '\n'
    + newMap + '\n'
    + MAP_END
    + content.slice(endIdx + MAP_END.length);

  // Also sync static sections (Stack / Entry Points / Key Scripts) from manifest
  const { stack, entries: entryLines, scripts } = buildStaticSections(manifestInfo);
  updated = replaceSection(updated, '## Stack', stack);
  updated = replaceSection(updated, '## Entry Points', entryLines);
  updated = replaceSection(updated, '## Key Scripts', scripts);

  await vscode.workspace.fs.writeFile(projectMdUri, Buffer.from(updated, 'utf8'));

  const dirCount = dirEntries.filter(e => e.type === 'dir').length;
  if (silent) {
    vscode.window.setStatusBarMessage(
      `Venom's Token Pilot: project.md auto-refreshed (${dirCount} dirs)`, 4000
    );
  } else {
    vscode.window.showInformationMessage(
      `Venom's Token Pilot: Project map refreshed — ${dirCount} dirs, ${manifestInfo.depNames.length} runtime deps.`
    );
  }
}
