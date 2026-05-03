import * as vscode from 'vscode';
import * as path from 'path';
import { safeWrite, ensureDir, applyTokens, readIfExists } from '../fileUtils';
import { getConfig } from '../config';
import { parsePackageJson, parsePyprojectToml, ManifestInfo } from '../scanner/manifestParser';

interface TemplateSpec {
  templateName: string;
  relativePath: string;
  tokens: (root: vscode.Uri, name: string, date: string) => Record<string, string>;
}

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

function buildProjectTokens(name: string, date: string, info: ManifestInfo | undefined): Record<string, string> {
  if (!info) {
    return {
      PROJECT_NAME: name,
      STACK_LANG: 'Unknown',
      STACK_FRAMEWORK: 'Unknown',
      PKG_MANAGER: 'npm',
      ENTRY_POINTS: '- (run Refresh Project Map to populate)',
      SCRIPTS: '- (run Refresh Project Map to populate)',
      DIR_TREE: '(run Refresh Project Map to populate)',
      DATE: date,
    };
  }
  const langLabel = info.lang === 'node' ? 'TypeScript / JavaScript' : info.lang === 'python' ? 'Python' : 'Unknown';
  const pkgMgr    = info.lang === 'node' ? 'npm' : 'pip / poetry';
  const entries   = info.entryPoints.length > 0
    ? info.entryPoints.map(e => `- \`${e}\``).join('\n')
    : '- (see manifest)';
  const scripts   = Object.entries(info.scripts).length > 0
    ? Object.entries(info.scripts).slice(0, 8).map(([k, v]) => `- \`${k}\`${v ? ': ' + v : ''}`).join('\n')
    : '- (none defined)';
  return {
    PROJECT_NAME:   name,
    STACK_LANG:     langLabel,
    STACK_FRAMEWORK: detectFramework(info),
    PKG_MANAGER:    pkgMgr,
    ENTRY_POINTS:   entries,
    SCRIPTS:        scripts,
    DIR_TREE:       '(run Refresh Project Map to populate)',
    DATE:           date,
  };
}

const NON_PROJECT_TEMPLATES: TemplateSpec[] = [
  {
    templateName: 'CLAUDE.md.tmpl',
    relativePath: 'CLAUDE.md',
    tokens: (_root, name) => ({ PROJECT_NAME: name }),
  },
  {
    templateName: 'plan.md.tmpl',
    relativePath: 'plan.md',
    tokens: (_root, _name, date) => ({
      YOUR_GOAL: 'Define your goal',
      YOUR_GOAL_DESCRIPTION: 'Describe what you want to accomplish.',
      DONE_CRITERION: 'Define what done looks like',
      STEP_1_TITLE: 'First step',
      STEP_1_TASK: 'Describe the first task',
      FILE_1: 'path/to/file.ts',
      DATE: date,
    }),
  },
  {
    templateName: 'claudeignore.tmpl',
    relativePath: '.claudeignore',
    tokens: () => ({}),
  },
  {
    templateName: 'brain.md.tmpl',
    relativePath: path.join('.agent', 'brain.md'),
    tokens: (_root, name, date) => ({
      PROJECT_NAME: name,
      BRAIN_MAX_LINES: String(getConfig().brainMaxLines),
      DATE: date,
    }),
  },
  {
    templateName: 'updates.md.tmpl',
    relativePath: path.join('.agent', 'updates.md'),
    tokens: () => ({}),
  },
];

export function registerInitProject(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.initProject', () => runInit(context))
  );
}

export async function runInit(
  context: vscode.ExtensionContext,
  silent = false
): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage("Venom's Token Pilot: No workspace folder open.");
    return;
  }

  const root = folders[0].uri;
  const projectName = path.basename(root.fsPath);
  const date = new Date().toISOString().slice(0, 10);

  // Ensure .agent/ directory exists
  await ensureDir(vscode.Uri.joinPath(root, '.agent'));

  // Detect manifest for real project.md values
  let manifestInfo: ManifestInfo | undefined;
  try {
    const pkgText = await readIfExists(vscode.Uri.joinPath(root, 'package.json'));
    if (pkgText) {
      manifestInfo = parsePackageJson(pkgText);
    } else {
      const pyText = await readIfExists(vscode.Uri.joinPath(root, 'pyproject.toml'));
      if (pyText) { manifestInfo = parsePyprojectToml(pyText); }
    }
  } catch { /* keep undefined */ }

  // Build full template list: project.md with real tokens + the rest
  const allTemplates: TemplateSpec[] = [
    {
      templateName: 'project.md.tmpl',
      relativePath: 'project.md',
      tokens: (_root, name, d) => buildProjectTokens(name, d, manifestInfo),
    },
    ...NON_PROJECT_TEMPLATES,
  ];

  let written = 0;
  let skipped = 0;

  for (const spec of allTemplates) {
    const templateUri = vscode.Uri.joinPath(
      context.extensionUri,
      'resources', 'templates', spec.templateName
    );

    let templateContent: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(templateUri);
      templateContent = Buffer.from(bytes).toString('utf8');
    } catch {
      vscode.window.showErrorMessage(
        `Venom's Token Pilot: Could not read template ${spec.templateName}`
      );
      continue;
    }

    const tokens = spec.tokens(root, projectName, date);
    const content = applyTokens(templateContent, tokens);
    const destUri = vscode.Uri.joinPath(root, spec.relativePath);

    const didWrite = await safeWrite(destUri, content, false);
    didWrite ? written++ : skipped++;
  }

  // Auto-populate dir tree in project.md if manifest was found
  if (manifestInfo) {
    const { runRefreshMap } = await import('./refreshMap');
    await runRefreshMap(true);
  }

  if (!silent) {
    const msg = skipped > 0
      ? `Venom's Token Pilot: Created ${written} file(s). Skipped ${skipped} existing file(s).`
      : `Venom's Token Pilot: Initialized ${written} artifact file(s).`;
    vscode.window.showInformationMessage(msg);
  }
}
