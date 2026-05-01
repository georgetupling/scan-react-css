import type { SelectorBranchNode } from "../fact-graph/index.js";
import type { SourceAnchor } from "../../types/core.js";

export function selectorBranchSourceKey(input: {
  ruleKey?: string;
  branchIndex?: number;
  selectorText?: string;
  location?: SourceAnchor;
}): string {
  return [
    input.ruleKey ?? "direct-query",
    input.branchIndex ?? 0,
    input.selectorText ?? "",
    input.location ? anchorKey(input.location) : "",
  ].join(":");
}

export function selectorBranchNodeSourceKey(branch: SelectorBranchNode): string {
  return selectorBranchSourceKey({
    ruleKey: branch.ruleKey,
    branchIndex: branch.branchIndex,
    selectorText: branch.selectorText,
    location: branch.location,
  });
}

export function selectorBranchMatchId(input: {
  selectorBranchNodeId: string;
  elementId: string;
}): string {
  return `selector-branch-match:${normalizeIdPart(input.selectorBranchNodeId)}:${normalizeIdPart(input.elementId)}`;
}

export function selectorElementMatchId(input: {
  selectorBranchNodeId: string;
  elementId: string;
}): string {
  return `selector-element-match:${normalizeIdPart(input.selectorBranchNodeId)}:${normalizeIdPart(input.elementId)}`;
}

export function selectorReachabilityDiagnosticId(input: {
  selectorBranchNodeId: string;
  code: string;
}): string {
  return `selector-reachability-diagnostic:${normalizeIdPart(input.selectorBranchNodeId)}:${normalizeIdPart(input.code)}`;
}

function anchorKey(anchor: SourceAnchor): string {
  return [
    normalizeProjectPath(anchor.filePath),
    anchor.startLine,
    anchor.startColumn,
    anchor.endLine ?? "",
    anchor.endColumn ?? "",
  ].join(":");
}

function normalizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:/-]+/g, "-");
}

function normalizeProjectPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
