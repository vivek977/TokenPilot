// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

export interface PruneResult {
  pruned: string;
  removedCount: number;
  placeholderCount: number;
  placeholderLines: string[];
}

// Must stay in sync with updatesMerger.ts PLACEHOLDER_BULLETS
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

function isPlaceholder(line: string): boolean {
  const lower = line.trim().replace(/^-\s*/, '').toLowerCase();
  return PLACEHOLDER_BULLETS.has(lower);
}

export function findPlaceholders(content: string): string[] {
  return content.split('\n').filter(l => l.trim().startsWith('-') && isPlaceholder(l));
}

export function removePlaceholders(content: string): { result: string; count: number } {
  const lines = content.split('\n');
  const kept: string[] = [];
  let count = 0;
  for (const line of lines) {
    if (line.trim().startsWith('-') && isPlaceholder(line)) {
      count++;
    } else {
      kept.push(line);
    }
  }
  return { result: kept.join('\n'), count };
}

export function pruneBrain(content: string): PruneResult {
  const lines   = content.split('\n');
  const seen    = new Set<string>();
  const result: string[] = [];
  let removedCount = 0;

  for (const line of lines) {
    const normalized = line.trim().toLowerCase();

    // Only deduplicate non-empty bullet lines
    if (normalized.startsWith('-') && normalized.length > 1) {
      if (seen.has(normalized)) {
        removedCount++;
        continue;
      }
      seen.add(normalized);
    }

    result.push(line);
  }

  // Detect placeholders in the deduplicated result (reported separately, removed on user confirm)
  const placeholderLines = findPlaceholders(result.join('\n'));

  return { pruned: result.join('\n'), removedCount, placeholderCount: placeholderLines.length, placeholderLines };
}
