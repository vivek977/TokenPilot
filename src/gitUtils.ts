// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export function readGitignorePatterns(rootPath: string): string[] {
  try {
    const content = fs.readFileSync(path.join(rootPath, '.gitignore'), 'utf8');
    return content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

export function isDirty(rootPath: string): boolean {
  try {
    const out = execSync('git status --porcelain', { cwd: rootPath, timeout: 3000 }).toString();
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

/** Returns the date of the most recent git commit as YYYY-MM-DD, or null if not a git repo. */
export function getLastCommitDate(rootPath: string): string | null {
  try {
    const out = execSync('git log -1 --format=%cd --date=short', { cwd: rootPath, timeout: 3000 }).toString().trim();
    return out.length === 10 ? out : null; // YYYY-MM-DD is exactly 10 chars
  } catch {
    return null;
  }
}
