// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import { ParsedStep } from './planReader';

export interface PacketOptions {
  step: ParsedStep;
  projectSummary: string;
  mode: 'claudeCode' | 'hitl';
  includeBrain: boolean;
  brainSnippet?: string;
  maxAtPaths: number;
}

export interface PacketResult {
  text: string;
  atPathCount: number;
  warned: boolean;
}

export function buildPacket(opts: PacketOptions): PacketResult {
  const { step, projectSummary, mode, includeBrain, brainSnippet, maxAtPaths } = opts;
  const date        = new Date().toISOString().slice(0, 10);
  const atPathCount = step.files.length;
  const warned      = atPathCount > maxAtPaths;
  const modeLabel   = mode === 'claudeCode' ? 'Claude Code' : 'Human-in-the-Loop';

  const L: string[] = [];

  L.push(`<!-- Venom's Token Pilot Prompt Packet — ${date} -->`);
  L.push(`<!-- Step ${step.stepIndex} of ${step.totalSteps} | ${atPathCount} path(s) | Mode: ${modeLabel} -->`);
  if (warned) {
    L.push(`<!-- ⚠ ${atPathCount} paths exceeds recommended max of ${maxAtPaths} — consider splitting the step -->`);
  }
  L.push('');

  // ── Current Task ──────────────────────────────────────────────────────────
  L.push('## Current Task');
  L.push('');
  if (step.goal) {
    L.push(`**Goal:** ${step.goal}`);
    L.push('');
  }
  L.push(`**Step ${step.stepIndex} of ${step.totalSteps}:** ${step.stepTitle}`);
  L.push('');

  if (step.tasks.length > 0) {
    L.push('**Tasks:**');
    step.tasks.forEach(t => L.push(`- ${t}`));
    L.push('');
  }

  if (step.doneCriteria.length > 0) {
    L.push('**Definition of Done:**');
    step.doneCriteria.forEach(d => L.push(`- ${d}`));
    L.push('');
  }

  // ── Scope Contract ────────────────────────────────────────────────────────
  L.push('## Scope Contract');
  L.push('');
  L.push('- Only touch the files listed below — do not expand to unrelated modules.');
  L.push('- Use **subagents** for any broad exploration; return only summaries to main thread.');
  if (mode === 'claudeCode') {
    L.push('- Use **plan mode** (Shift+Tab) before making disk edits.');
  }
  L.push('');

  // ── Files ─────────────────────────────────────────────────────────────────
  if (step.files.length > 0) {
    L.push('## Files for This Step');
    L.push('');
    if (mode === 'claudeCode') {
      step.files.forEach(f => L.push(`- @${f}`));
    } else {
      L.push('*(Paste file contents below each path)*');
      L.push('');
      step.files.forEach(f => L.push(`- ${f}`));
    }
    L.push('');
  }

  // ── Project Context ───────────────────────────────────────────────────────
  if (projectSummary.trim()) {
    L.push('## Project Context');
    L.push('');
    L.push(projectSummary.trim());
    L.push('');
  }

  // ── Brain context (optional) ──────────────────────────────────────────────
  if (includeBrain && brainSnippet?.trim()) {
    L.push('## Brain Context');
    L.push('');
    L.push(brainSnippet.trim());
    L.push('');
  }

  // ── After This Task (Claude Code mode only) ───────────────────────────────
  if (mode === 'claudeCode') {
    L.push('## After This Task');
    L.push('');
    L.push('Append to `.agent/updates.md` before stopping:');
    L.push('');
    L.push('```');
    L.push('---UPDATE---');
    L.push('target: Status');
    L.push(`date: ${date}`);
    L.push('(one sentence: codebase state after this task)');
    L.push('---END---');
    L.push('');
    L.push('---UPDATE---');
    L.push('target: Active Task');
    L.push(`date: ${date}`);
    L.push('- (none)');
    L.push('---END---');
    L.push('```');
    L.push('');
    L.push('Also one entry per: decision made, gotcha found, mistake fixed.');
    L.push('`target: Decisions` | `target: Gotchas` | `target: Do-Not-Repeat`');
    L.push('');
  }

  return { text: L.join('\n'), atPathCount, warned };
}
