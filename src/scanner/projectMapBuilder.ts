// Copyright (c) 2026 venom — https://github.com/vivek977/TokenPilot
// Licensed under MIT. Attribution required — do not remove this notice.

import { ManifestInfo } from './manifestParser';
import { DirEntry } from './dirTree';

export function buildProjectMap(info: ManifestInfo, entries: DirEntry[]): string {
  const lines: string[] = [];

  const langLabel = info.lang === 'node' ? 'TypeScript / Node.js'
    : info.lang === 'python' ? 'Python'
    : 'Unknown';
  lines.push(`**Stack:** ${langLabel} — ${info.name}@${info.version}`);

  if (info.entryPoints.length > 0) {
    lines.push(`**Entry:** ${info.entryPoints.join(', ')}`);
  }

  const scriptKeys = Object.keys(info.scripts);
  if (scriptKeys.length > 0) {
    lines.push(`**Scripts:** ${scriptKeys.join(' · ')}`);
  }

  if (info.depNames.length > 0) {
    const shown = info.depNames.slice(0, 10).join(', ');
    const extra = info.depNames.length > 10 ? ` … +${info.depNames.length - 10} more` : '';
    lines.push(`**Runtime deps (${info.depNames.length}):** ${shown}${extra}`);
  }

  if (info.devDepNames.length > 0) {
    const shown = info.devDepNames.slice(0, 6).join(', ');
    const extra = info.devDepNames.length > 6 ? ` … +${info.devDepNames.length - 6} more` : '';
    lines.push(`**Dev deps (${info.devDepNames.length}):** ${shown}${extra}`);
  }

  lines.push('');
  lines.push('### Top-level layout');
  lines.push('```');
  for (const e of entries.slice(0, 20)) {
    lines.push(e.type === 'dir' ? `${e.name}/` : e.name);
  }
  lines.push('```');

  return lines.join('\n');
}
