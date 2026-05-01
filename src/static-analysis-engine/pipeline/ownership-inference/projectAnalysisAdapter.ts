import type {
  ClassOwnershipAnalysis,
  ClassOwnershipEvidenceKind,
  OwnerCandidate,
  OwnerCandidateReason,
} from "../project-analysis/index.js";
import type {
  OwnershipEvidenceKind,
  OwnershipInferenceResult,
  StyleOwnerCandidate,
} from "./types.js";

export function classOwnershipAnalysisFromOwnershipInference(
  result: OwnershipInferenceResult,
): ClassOwnershipAnalysis[] {
  return result.classOwnership
    .map((ownership) => ({
      id: ownership.id,
      classDefinitionId: ownership.classDefinitionId,
      stylesheetId: ownership.stylesheetId,
      className: ownership.className,
      consumerSummary: ownership.consumerSummary,
      ownerCandidates: ownership.ownerCandidateIds
        .map((candidateId) => result.indexes.ownerCandidateById.get(candidateId))
        .filter((candidate): candidate is StyleOwnerCandidate => Boolean(candidate))
        .map(projectAnalysisOwnerCandidateFromEvidence),
      evidenceKind:
        ownership.compatibilityEvidenceKind ??
        projectAnalysisEvidenceKindFromOwnershipEvidence(ownership.evidenceKind),
      confidence: ownership.confidence,
      traces: ownership.traces,
    }))
    .sort(compareById);
}

function projectAnalysisOwnerCandidateFromEvidence(candidate: StyleOwnerCandidate): OwnerCandidate {
  return {
    kind: mapProjectAnalysisOwnerCandidateKind(candidate.ownerKind),
    id: candidate.ownerId,
    path: candidate.ownerPath,
    confidence: candidate.confidence,
    reasons: candidate.reasons
      .filter(isProjectAnalysisOwnerReason)
      .sort((left, right) => left.localeCompare(right)),
    traces: candidate.traces,
  };
}

function projectAnalysisEvidenceKindFromOwnershipEvidence(
  kind: OwnershipEvidenceKind,
): ClassOwnershipEvidenceKind {
  switch (kind) {
    case "private-component":
    case "module-local":
      return "path-convention";
    case "single-consuming-component":
      return "single-consuming-component";
    case "shared-component-family":
    case "broad-stylesheet":
    case "contextual-selector":
      return "multi-consumer";
    case "unresolved":
      return "unknown";
  }
}

function mapProjectAnalysisOwnerCandidateKind(
  candidateKind: StyleOwnerCandidate["ownerKind"],
): OwnerCandidate["kind"] {
  switch (candidateKind) {
    case "component":
      return "component";
    case "source-file":
      return "source-file";
    case "directory":
      return "directory";
    case "shared-layer":
    case "unknown":
      return "unknown";
  }
}

function isProjectAnalysisOwnerReason(reason: string): reason is OwnerCandidateReason {
  return [
    "single-importing-component",
    "single-consuming-component",
    "same-directory",
    "sibling-basename-convention",
    "component-folder-convention",
    "feature-folder-convention",
    "multi-consumer",
    "unknown",
  ].includes(reason);
}

function compareById(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}
