import * as vscode from 'vscode';
import * as path from 'path';
import { readIfExists, safeWrite, applyTokens } from '../fileUtils';
import { getConfig } from '../config';

const VERSION_STAMP_RE = /<!--\s*(?:budget-agent|venom-tokenpilot)-version:\s*([\d.]+)\s*-->/;

// Files we manage and can auto-upgrade
// brain.md uses additive strategy (add missing sections, keep existing bullets)
// CLAUDE.md and updates.md use full-rewrite strategy (no user content to preserve)
const UPGRADEABLE: Array<{
  relativePath: string;
  templateName: string;
  strategy: 'rewrite' | 'additive';
  tokens: (projectName: string, date: string, cfg: ReturnType<typeof getConfig>) => Record<string, string>;
}> = [
  {
    relativePath: 'CLAUDE.md',
    templateName: 'CLAUDE.md.tmpl',
    strategy: 'rewrite',
    tokens: (name) => ({ PROJECT_NAME: name }),
  },
  {
    relativePath: path.join('.agent', 'brain.md'),
    templateName: 'brain.md.tmpl',
    strategy: 'additive',
    tokens: (name, date, cfg) => ({
      PROJECT_NAME: name,
      BRAIN_MAX_LINES: String(cfg.brainMaxLines),
      DATE: date,
    }),
  },
  {
    relativePath: path.join('.agent', 'updates.md'),
    templateName: 'updates.md.tmpl',
    strategy: 'rewrite',
    tokens: () => ({}),
  },
];

// All 7 brain sections in order — additive upgrade ensures all exist
const BRAIN_SECTIONS = [
  'Status',
  'Active Task',
  'Pending',
  'Decisions',
  'Gotchas',
  'Do-Not-Repeat',
  'Promoted Insights',
];

function extractVersion(content: string): string | null {
  const m = content.match(VERSION_STAMP_RE);
  return m ? m[1] : null;
}

function versionsMatch(a: string, b: string): boolean {
  return a === b;
}

/** Add any brain.md sections missing from current content without touching existing bullets. */
function addMissingSections(current: string, templateContent: string): string {
  let result = current;
  for (const section of BRAIN_SECTIONS) {
    if (!new RegExp(`^##\\s+${section}\\s*$`, 'm').test(result)) {
      // Extract the section block from the template
      const tmplLines = templateContent.split('\n');
      const startIdx = tmplLines.findIndex(l => l.trim() === `## ${section}`);
      if (startIdx === -1) { continue; }
      const endIdx = tmplLines.findIndex((l, i) => i > startIdx && /^##\s/.test(l));
      const block = tmplLines.slice(startIdx, endIdx === -1 ? undefined : endIdx).join('\n');
      result = result.trimEnd() + '\n\n' + block + '\n';
    }
  }
  // Update the version stamp
  if (VERSION_STAMP_RE.test(result)) {
    result = result.replace(VERSION_STAMP_RE, (_, _v) => {
      const newStamp = templateContent.match(VERSION_STAMP_RE)?.[0] ?? '';
      return newStamp;
    });
  } else {
    // Prepend stamp after first heading line
    const lines = result.split('\n');
    const headingIdx = lines.findIndex(l => /^#\s/.test(l));
    if (headingIdx !== -1) {
      const stamp = templateContent.match(VERSION_STAMP_RE)?.[0] ?? '';
      lines.splice(headingIdx + 2, 0, stamp);
      result = lines.join('\n');
    }
  }
  return result;
}

export async function runUpgradeCheck(
  context: vscode.ExtensionContext,
  root: vscode.Uri,
  extensionVersion: string
): Promise<void> {
  const projectName = path.basename(root.fsPath);
  const date = new Date().toISOString().slice(0, 10);
  const cfg = getConfig();

  // Check which files are outdated
  const outdated: typeof UPGRADEABLE = [];
  for (const spec of UPGRADEABLE) {
    const parts = spec.relativePath.split(/[/\\]/);
    const fileUri = vscode.Uri.joinPath(root, ...parts);
    const content = await readIfExists(fileUri);
    if (content === null) { continue; } // doesn't exist — init will handle it
    const fileVersion = extractVersion(content);
    if (!fileVersion || !versionsMatch(fileVersion, extensionVersion)) {
      outdated.push(spec);
    }
  }

  if (outdated.length === 0) { return; }

  const fileList = outdated.map(s => path.basename(s.relativePath)).join(', ');
  const answer = await vscode.window.showInformationMessage(
    `Venom's Token Pilot: ${outdated.length} file(s) are from an older version (${fileList}). Upgrade now?`,
    'Upgrade',
    'Skip'
  );
  if (answer !== 'Upgrade') { return; }

  let upgraded = 0;
  for (const spec of outdated) {
    const templateUri = vscode.Uri.joinPath(
      context.extensionUri,
      'resources', 'templates', spec.templateName
    );
    let templateContent: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(templateUri);
      templateContent = Buffer.from(bytes).toString('utf8');
    } catch {
      continue;
    }

    const parts = spec.relativePath.split(/[/\\]/);
    const fileUri = vscode.Uri.joinPath(root, ...parts);

    if (spec.strategy === 'rewrite') {
      const content = applyTokens(templateContent, spec.tokens(projectName, date, cfg));
      await safeWrite(fileUri, content, true);
      upgraded++;
    } else {
      // additive: preserve existing content, add missing sections
      const existing = await readIfExists(fileUri);
      if (!existing) { continue; }
      const resolved = applyTokens(templateContent, spec.tokens(projectName, date, cfg));
      const merged = addMissingSections(existing, resolved);
      await safeWrite(fileUri, merged, true);
      upgraded++;
    }
  }

  vscode.window.showInformationMessage(
    `Venom's Token Pilot: Upgraded ${upgraded} file(s) to v${extensionVersion}.`
  );
}
