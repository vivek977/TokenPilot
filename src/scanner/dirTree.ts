import * as fs from 'fs';

const NOISE = new Set([
  'node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.output',
  '__pycache__', '.venv', 'venv', 'coverage', '.nyc_output', '.cache',
  'tmp', 'temp', '.turbo', '.parcel-cache', 'storybook-static', '.git',
]);

export interface DirEntry {
  name: string;
  type: 'dir' | 'file';
}

export function listTopLevelEntries(rootPath: string, ignorePatterns: string[]): DirEntry[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootPath, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(e => !NOISE.has(e.name) && !matchesAny(e.name, ignorePatterns))
    .map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' } as DirEntry))
    .sort((a, b) => {
      if (a.type !== b.type) { return a.type === 'dir' ? -1 : 1; }
      return a.name.localeCompare(b.name);
    });
}

function matchesAny(name: string, patterns: string[]): boolean {
  return patterns.some(p => {
    const clean = p.replace(/\/$/, '');
    if (clean === name) { return true; }
    if (clean.startsWith('*.') && name.endsWith(clean.slice(1))) { return true; }
    if (clean === `**/${name}`) { return true; }
    return false;
  });
}
