export function activeBranch<T extends { id: string; parentMessageId: string | null }>(messages: T[], leafId: string | null): T[] {
  const map = new Map(messages.map(x => [x.id, x])); const branch: T[] = []; const visited = new Set<string>();
  let cursor = leafId;
  while (cursor && !visited.has(cursor)) { visited.add(cursor); const message = map.get(cursor); if (!message) break; branch.unshift(message); cursor = message.parentMessageId; }
  return branch;
}

export function newestDescendant<T extends { id: string; parentMessageId: string | null; createdAt: string }>(nodes: T[], root: string) {
  let leaf = root; const visited = new Set<string>();
  while (!visited.has(leaf)) { visited.add(leaf); const children = nodes.filter(x => x.parentMessageId === leaf).sort((a,b) => a.createdAt.localeCompare(b.createdAt)); if (!children.length) break; leaf = children.at(-1)!.id; }
  return leaf;
}
