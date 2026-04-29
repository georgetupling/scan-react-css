import type { FactEdgeId, FactNodeId } from "./types.js";

export function fileResourceNodeId(filePath: string): FactNodeId {
  return `file:${normalizeIdPart(filePath)}`;
}

export function moduleNodeId(filePath: string): FactNodeId {
  return `module:${normalizeIdPart(filePath)}`;
}

export function stylesheetNodeId(filePath: string): FactNodeId {
  return `stylesheet:${normalizeIdPart(filePath)}`;
}

export function originatesFromFileEdgeId(from: FactNodeId, to: FactNodeId): FactEdgeId {
  return `originates-from-file:${from}->${to}`;
}

export function normalizeIdPart(value: string): string {
  return value.replace(/\\/g, "/");
}
