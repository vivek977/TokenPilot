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
