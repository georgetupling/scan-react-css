export function collectReachableAncestors(
  sourceFilePath: string,
  ancestorsBySourcePath: Map<string, Set<string>>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [...(ancestorsBySourcePath.get(sourceFilePath) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);

    for (const ancestor of ancestorsBySourcePath.get(current) ?? []) {
      if (!visited.has(ancestor)) {
        queue.push(ancestor);
      }
    }
  }

  return visited;
}

export function unionSets(sets: Array<Set<string>>): Set<string> {
  const union = new Set<string>();

  for (const currentSet of sets) {
    for (const item of currentSet) {
      union.add(item);
    }
  }

  return union;
}

export function intersectSets(sets: Array<Set<string>>): Set<string> {
  if (sets.length === 0) {
    return new Set<string>();
  }

  const intersection = new Set(sets[0]);
  for (const currentSet of sets.slice(1)) {
    for (const item of intersection) {
      if (!currentSet.has(item)) {
        intersection.delete(item);
      }
    }
  }

  return intersection;
}
