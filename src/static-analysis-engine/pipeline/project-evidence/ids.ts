import type { ProjectEvidenceDiagnosticTargetKind } from "./types.js";

export function stylesheetReachabilityEvidenceId(input: {
  stylesheetId: string;
  sourceFileId?: string;
  componentId?: string;
  availability: string;
}): string {
  return [
    "project-evidence:stylesheet-reachability",
    normalizeIdPart(input.stylesheetId),
    normalizeIdPart(input.sourceFileId ?? "no-source"),
    normalizeIdPart(input.componentId ?? "no-component"),
    normalizeIdPart(input.availability),
  ].join(":");
}

export function projectEvidenceDiagnosticId(input: {
  targetKind: ProjectEvidenceDiagnosticTargetKind;
  targetId?: string;
  code: string;
}): string {
  return [
    "project-evidence:diagnostic",
    normalizeIdPart(input.targetKind),
    normalizeIdPart(input.targetId ?? "project"),
    normalizeIdPart(input.code),
  ].join(":");
}

function normalizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:/-]+/g, "-");
}
