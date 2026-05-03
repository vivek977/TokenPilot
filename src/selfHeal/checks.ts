import * as vscode from 'vscode';
import { readIfExists, safeWrite } from '../fileUtils';
import { getConfig } from '../config';
import { readBrain, lineCount } from '../brain/brainManager';
import { isDirty } from '../gitUtils';
import { parseCurrentStep } from '../packet/planReader';

export interface FixSpec {
  description: string;
  apply: () => Promise<void>;
}

export interface CheckResult {
  id: string;
  label: string;
  severity: 'warning' | 'info';
  message: string;
  fix?: FixSpec;
}

const REQUIRED_IGNORES = [
  'node_modules/', 'dist/', 'build/', '.next/', '__pycache__/',
  '*.log', 'coverage/', 'venv/', '.venv/',
];

const CLAUDEIGNORE_BASELINE = `# Added by Venom's Token Pilot self-heal
node_modules/
dist/
build/
.next/
__pycache__/
*.log
coverage/
venv/
.venv/
*.lock
`;

export async function runAllChecks(root: vscode.Uri): Promise<CheckResult[]> {
  const results = await Promise.all([
    checkClaudeIgnoreMissing(root),
    checkIgnorePatterns(root),
    checkClaudeMdOversize(root),
    checkPlanMdWhileDirty(root),
    checkBrainOverCap(root),
    checkOrphanPlaceholders(root),
  ]);

  return results.flat().filter((r): r is CheckResult => r !== null);
}

// ── Individual checks ──────────────────────────────────────────────────────

async function checkClaudeIgnoreMissing(root: vscode.Uri): Promise<CheckResult | null> {
  const content = await readIfExists(vscode.Uri.joinPath(root, '.claudeignore'));
  if (content !== null) { return null; }

  const uri = vscode.Uri.joinPath(root, '.claudeignore');
  return {
    id: 'claudeignore-missing',
    label: '.claudeignore missing',
    severity: 'warning',
    message: '.claudeignore not found — Claude will autonomously read node_modules, dist, and other noise.',
    fix: {
      description: 'Create .claudeignore with baseline patterns',
      apply: async () => { await safeWrite(uri, CLAUDEIGNORE_BASELINE, false); },
    },
  };
}

async function checkIgnorePatterns(root: vscode.Uri): Promise<CheckResult[]> {
  const content = await readIfExists(vscode.Uri.joinPath(root, '.claudeignore'));
  if (!content) { return []; }

  const missing = REQUIRED_IGNORES.filter(p => !content.includes(p));
  if (missing.length === 0) { return []; }

  const uri = vscode.Uri.joinPath(root, '.claudeignore');
  return [{
    id: 'claudeignore-patterns',
    label: `Missing ignore patterns (${missing.length})`,
    severity: 'warning',
    message: `Missing from .claudeignore: ${missing.join(', ')}. These paths may be read autonomously.`,
    fix: {
      description: `Append ${missing.length} missing pattern(s) to .claudeignore`,
      apply: async () => {
        const current = await readIfExists(uri) ?? '';
        const toAdd   = missing.filter(p => !current.includes(p));
        const appended = current.trimEnd() + "\n\n# Added by Venom's Token Pilot\n" + toAdd.join('\n') + '\n';
        await vscode.workspace.fs.writeFile(uri, Buffer.from(appended, 'utf8'));
      },
    },
  }];
}

async function checkClaudeMdOversize(root: vscode.Uri): Promise<CheckResult | null> {
  const content = await readIfExists(vscode.Uri.joinPath(root, 'CLAUDE.md'));
  if (!content) { return null; }

  const cfg    = getConfig();
  const lines  = content.split('\n').length;
  const tokens = Math.ceil(content.length / 4);

  if (lines <= cfg.claudeMdMaxLines && tokens <= cfg.claudeMdMaxTokens) { return null; }

  return {
    id: 'claude-md-oversize',
    label: `CLAUDE.md too large (${lines} lines, ~${tokens} tokens)`,
    severity: 'warning',
    message: `CLAUDE.md is re-sent on every message. Move verbose sections to .claude/skills/ or docs/.`,
  };
}

async function checkPlanMdWhileDirty(root: vscode.Uri): Promise<CheckResult | null> {
  const content = await readIfExists(vscode.Uri.joinPath(root, 'plan.md'));
  if (!content) { return null; }

  const step  = parseCurrentStep(content);
  const dirty = isDirty(root.fsPath);

  if (step !== null || !dirty) { return null; }

  return {
    id: 'plan-empty-while-dirty',
    label: 'plan.md has no open steps but git is dirty',
    severity: 'info',
    message: 'All steps in plan.md are checked off, but git shows uncommitted changes. Is this work tracked?',
  };
}

async function checkBrainOverCap(root: vscode.Uri): Promise<CheckResult | null> {
  const content = await readBrain(root);
  if (!content) { return null; }

  const cfg   = getConfig();
  const lines = lineCount(content);
  if (lines <= cfg.brainMaxLines) { return null; }

  return {
    id: 'brain-over-cap',
    label: `brain.md over cap (${lines}/${cfg.brainMaxLines} lines)`,
    severity: 'warning',
    message: `brain.md exceeds the ${cfg.brainMaxLines}-line cap. Run Prune Brain to remove duplicates.`,
    fix: {
      description: 'Run Prune Brain to remove duplicate entries',
      apply: async () => { vscode.commands.executeCommand('tokenPilot.pruneBrain'); },
    },
  };
}

async function checkOrphanPlaceholders(root: vscode.Uri): Promise<CheckResult[]> {
  const files = ['CLAUDE.md', 'project.md', 'plan.md'];
  const results: CheckResult[] = [];

  for (const filename of files) {
    const content = await readIfExists(vscode.Uri.joinPath(root, filename));
    if (!content) { continue; }

    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) { continue; }

    const unique = [...new Set(matches)];
    results.push({
      id:       `placeholder-${filename}`,
      label:    `Unfilled placeholders in ${filename}`,
      severity: 'info',
      message:  `${filename} still contains: ${unique.join(', ')}. Replace with real content.`,
    });
  }

  return results;
}
