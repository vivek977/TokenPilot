export interface PruneResult {
  pruned: string;
  removedCount: number;
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

  return { pruned: result.join('\n'), removedCount };
}
