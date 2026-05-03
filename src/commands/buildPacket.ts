import * as vscode from 'vscode';
import { readIfExists } from '../fileUtils';
import { getConfig } from '../config';
import { parseCurrentStep } from '../packet/planReader';
import { buildPacket } from '../packet/packetBuilder';
import { markCurrentStepDone } from '../agentModes/hitlRunner';

const MAP_START = '<!-- PROJECT_MAP_START -->';
const MAP_END   = '<!-- PROJECT_MAP_END -->';

export function registerBuildPacket(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenPilot.buildPacket', () => runBuildPacket())
  );
}

async function runBuildPacket(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage("Venom's Token Pilot: No workspace folder open.");
    return;
  }

  const root = folders[0].uri;
  const cfg  = getConfig();

  // Read plan.md
  const planText = await readIfExists(vscode.Uri.joinPath(root, 'plan.md'));
  if (!planText) {
    vscode.window.showWarningMessage("Venom's Token Pilot: plan.md not found. Run Initialize Project first.");
    return;
  }

  // Parse current step
  const step = parseCurrentStep(planText);
  if (!step) {
    vscode.window.showInformationMessage("Venom's Token Pilot: No unchecked steps found in plan.md — all done!");
    return;
  }

  // Extract project.md map section
  const projectText = await readIfExists(vscode.Uri.joinPath(root, 'project.md'));
  const projectSummary = extractMapSection(projectText ?? '');

  // Always extract brain live-state sections (Status, Active Task, Pending) + Decisions
  const brainText = await readIfExists(vscode.Uri.joinPath(root, '.agent', 'brain.md'));
  let brainSnippet: string | undefined;
  if (cfg.includeBrainInPacket && brainText) {
    brainSnippet = extractBrainContext(brainText);
  }

  const result = buildPacket({
    step,
    projectSummary,
    mode:          cfg.agentMode,
    includeBrain:  cfg.includeBrainInPacket,
    brainSnippet,
    maxAtPaths:    cfg.packetMaxAtPaths,
  });

  await vscode.env.clipboard.writeText(result.text);

  const warnSuffix = result.warned
    ? ` ⚠ ${result.atPathCount} paths exceeds max (${cfg.packetMaxAtPaths}) — consider splitting the step.`
    : '';

  const modeLabel = cfg.agentMode === 'hitl' ? ' [HITL mode]' : '';

  if (cfg.agentMode === 'hitl') {
    // In HITL mode: offer to mark step done after user pastes and gets answer
    const answer = await vscode.window.showInformationMessage(
      `Venom's Token Pilot: Packet copied — Step ${step.stepIndex}/${step.totalSteps}${modeLabel}.${warnSuffix} Paste into claude.ai, then mark step done when finished.`,
      'Mark Step Done', 'Later'
    );
    if (answer === 'Mark Step Done') {
      const marked = await markCurrentStepDone(root);
      if (marked) {
        vscode.window.showInformationMessage(
          `Venom's Token Pilot: Step ${step.stepIndex} marked done in plan.md.`
        );
      }
    }
  } else {
    vscode.window.showInformationMessage(
      `Venom's Token Pilot: Packet copied — Step ${step.stepIndex}/${step.totalSteps}, ${result.atPathCount} path(s).${warnSuffix}`
    );
  }
}

function extractMapSection(content: string): string {
  const start = content.indexOf(MAP_START);
  const end   = content.indexOf(MAP_END);
  if (start === -1 || end === -1) { return ''; }
  return content.slice(start + MAP_START.length, end).trim();
}

const LIVE_SECTIONS  = new Set(['Status', 'Active Task', 'Pending']);
const EXTRA_SECTIONS = new Set(['Decisions']);

function extractBrainContext(brain: string): string {
  const lines  = brain.split('\n');
  const result: string[] = [];
  let section        = '';
  let linesInSection = 0;

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      section = line.replace(/^##\s+/, '').trim();
      linesInSection = 0;
    }
    const isLive  = LIVE_SECTIONS.has(section);
    const isExtra = EXTRA_SECTIONS.has(section) && linesInSection < 10;
    if (isLive || isExtra) {
      result.push(line);
      linesInSection++;
    }
  }
  return result.join('\n');
}
