// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

export interface ParsedUpdate {
  target: string;
  date: string;
  lines: string[];
}

export const REPLACE_TARGETS = new Set(['Status', 'Active Task']);

// Template placeholder strings that should never land in brain.md
const PLACEHOLDER_BULLETS = new Set([
  'bullet or replacement text',
  'your_sentence',
  'add notes here',
  'add files here',
  '(add notes here)',
  '(add files here)',
  'one sentence: what is working, what is broken, what is half-done.',
  '(one sentence: codebase state after this task)',
]);

function isPlaceholder(text: string): boolean {
  const lower = text.replace(/^-\s*/, '').toLowerCase().trim();
  return PLACEHOLDER_BULLETS.has(lower);
}

const HEADER = "<!-- Venom's Token Pilot updates staging file. Claude Code appends entries here. Extension merges to brain.md. -->\n<!-- Do not edit manually. Auto-cleared after each merge. -->\n";

export function parseUpdates(content: string): ParsedUpdate[] {
  const results: ParsedUpdate[] = [];
  const blocks = content.split('---UPDATE---');

  for (const block of blocks.slice(1)) {
    const endIdx = block.indexOf('---END---');
    if (endIdx === -1) { continue; }

    const body  = block.slice(0, endIdx).trim();
    const lines = body.split('\n');

    let target = '';
    let date   = '';
    const contentLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('target:')) {
        target = trimmed.slice('target:'.length).trim();
      } else if (trimmed.startsWith('date:')) {
        date = trimmed.slice('date:'.length).trim();
      } else if (trimmed.length > 0) {
        contentLines.push(line);
      }
    }

    if (target && contentLines.length > 0) {
      results.push({ target, date, lines: contentLines });
    }
  }

  return results;
}

export function applyUpdatesToBrain(
  brainContent: string,
  updates: ParsedUpdate[],
  insertAfterHeading: (content: string, heading: string, bullet: string) => string,
  replaceSection: (content: string, heading: string, newBody: string) => string,
): string {
  let result = brainContent;

  for (const update of updates) {
    const heading = `## ${update.target}`;

    if (REPLACE_TARGETS.has(update.target)) {
      const newBody = update.lines.join('\n');
      result = replaceSection(result, heading, newBody);
    } else {
      for (const rawLine of update.lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) { continue; }
        // Auto-prefix lines that Claude wrote without a leading `-`
        const bullet = trimmed.startsWith('-') ? trimmed : `- ${trimmed}`;
        // Drop known template placeholder strings before they poison brain.md
        if (isPlaceholder(bullet)) { continue; }
        // Skip if duplicate (normalized comparison)
        const normalized = bullet.toLowerCase();
        if (result.split('\n').some(l => l.trim().toLowerCase() === normalized)) { continue; }
        result = insertAfterHeading(result, heading, bullet);
      }
    }
  }

  return result;
}

export function truncateUpdates(): string {
  return HEADER + '\n';
}
