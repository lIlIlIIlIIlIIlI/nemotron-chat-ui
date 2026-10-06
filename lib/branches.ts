export function activeBranch<T extends { id: string; parentMessageId: string | null }>(messages: T[], leafId: string | null): T[] {
  const map = new Map(messages.map(x => [x.id, x])); const branch: T[] = []; const visited = new Set<string>();
  let cursor = leafId;
  while (cursor && !visited.has(cursor)) { visited.add(cursor); const message = map.get(cursor); if (!message) break; branch.unshift(message); cursor = message.parentMessageId; }
  return branch;
}
