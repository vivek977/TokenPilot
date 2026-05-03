export interface ParsedUpdate {
  target: string;
  date: string;
  lines: string[];
}

export const REPLACE_TARGETS = new Set(['Status', 'Active Task']);

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
      for (const line of update.lines) {
        if (!line.trim().startsWith('-')) { continue; }
        // Skip if duplicate (normalized comparison)
        const normalized = line.trim().toLowerCase();
        if (result.split('\n').some(l => l.trim().toLowerCase() === normalized)) { continue; }
        result = insertAfterHeading(result, heading, line.trim());
      }
    }
  }

  return result;
}

export function truncateUpdates(): string {
  return HEADER + '\n';
}
