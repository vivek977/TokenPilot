export interface ParsedStep {
  stepTitle: string;
  stepIndex: number;
  totalSteps: number;
  tasks: string[];
  files: string[];
  goal: string;
  doneCriteria: string[];
}

export function parseCurrentStep(content: string): ParsedStep | null {
  const lines = content.split('\n');

  const goal        = extractSectionText(lines, '## Goal');
  const doneCriteria = extractListItems(lines, '## Definition of Done');
  const steps       = splitSteps(lines);

  for (let i = 0; i < steps.length; i++) {
    const { title, body } = steps[i];
    const unchecked = body.filter(l => /^\s*-\s+\[ \]/.test(l));
    if (unchecked.length === 0) { continue; }

    return {
      stepTitle:    title,
      stepIndex:    i + 1,
      totalSteps:   steps.length,
      tasks:        unchecked.map(l => l.replace(/^\s*-\s+\[ \]\s*/, '').trim()),
      files:        extractFiles(body),
      goal:         goal,
      doneCriteria: doneCriteria,
    };
  }

  return null; // all steps complete
}

// ── helpers ────────────────────────────────────────────────────────────────

interface StepSection { title: string; body: string[]; }

function splitSteps(lines: string[]): StepSection[] {
  const sections: StepSection[] = [];
  let current: StepSection | null = null;

  for (const line of lines) {
    if (/^###\s+Step\s+\d+/i.test(line)) {
      if (current) { sections.push(current); }
      current = { title: line.replace(/^###\s+Step\s+\d+\s*[—–-]?\s*/i, '').trim(), body: [] };
    } else if (current) {
      if (/^##\s/.test(line) && !/^###/.test(line)) {
        sections.push(current);
        current = null;
      } else {
        current.body.push(line);
      }
    }
  }
  if (current) { sections.push(current); }
  return sections;
}

function extractSectionText(lines: string[], heading: string): string {
  let inside = false;
  const parts: string[] = [];
  for (const line of lines) {
    if (line.startsWith(heading)) { inside = true; continue; }
    if (inside && /^##\s/.test(line)) { break; }
    if (inside && line.trim()) { parts.push(line.trim()); }
  }
  return parts.join(' ');
}

function extractListItems(lines: string[], heading: string): string[] {
  let inside = false;
  const items: string[] = [];
  for (const line of lines) {
    if (line.startsWith(heading)) { inside = true; continue; }
    if (inside && /^##\s/.test(line)) { break; }
    if (inside) {
      const m = line.match(/^\s*-\s+(?:\[[ x]\]\s*)?(.+)/);
      if (m) { items.push(m[1].trim()); }
    }
  }
  return items;
}

function extractFiles(body: string[]): string[] {
  for (const line of body) {
    if (/\*\*Files:\*\*/i.test(line)) {
      // strip markdown: **Files:** `path1`, `path2`  or  path1, path2
      const after = line.replace(/.*\*\*Files:\*\*\s*/i, '');
      return after
        .split(',')
        .map(p => p.trim().replace(/^`|`$/g, '').replace(/^@/, '').trim())
        .filter(Boolean);
    }
  }
  return [];
}
