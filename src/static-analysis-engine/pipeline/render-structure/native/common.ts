import type { RenderStructureInput } from "../types.js";

type Anchor = RenderStructureInput["graph"]["nodes"]["components"][number]["location"];

export function compareAnchors(left: Anchor, right: Anchor): number {
  return (
    normalizeProjectPath(left.filePath).localeCompare(normalizeProjectPath(right.filePath)) ||
    left.startLine - right.startLine ||
    left.startColumn - right.startColumn ||
    (left.endLine ?? 0) - (right.endLine ?? 0) ||
    (left.endColumn ?? 0) - (right.endColumn ?? 0)
  );
}

export function normalizeAnchor(anchor: Anchor): Anchor {
  return {
    ...anchor,
    filePath: normalizeProjectPath(anchor.filePath),
  };
}

export function normalizeProjectPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
