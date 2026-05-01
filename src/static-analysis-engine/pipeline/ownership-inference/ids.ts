import type {
  OwnershipCandidateOwnerKind,
  OwnershipCandidateTargetKind,
  OwnershipClassification,
  OwnershipClassificationTargetKind,
  OwnershipDiagnosticTargetKind,
} from "./types.js";

export function classOwnershipEvidenceId(input: { classDefinitionId: string }): string {
  return `ownership:class:${normalizeIdPart(input.classDefinitionId)}`;
}

export function classDefinitionConsumerEvidenceId(input: {
  classDefinitionId: string;
  referenceId: string;
  matchId?: string;
}): string {
  return [
    "ownership:consumer",
    normalizeIdPart(input.classDefinitionId),
    normalizeIdPart(input.referenceId),
    normalizeIdPart(input.matchId ?? "no-match"),
  ].join(":");
}

export function styleOwnerCandidateId(input: {
  targetKind: OwnershipCandidateTargetKind;
  targetId: string;
  ownerKind: OwnershipCandidateOwnerKind;
  ownerId?: string;
  ownerPath?: string;
  reasonKey?: string;
}): string {
  return [
    "ownership:candidate",
    normalizeIdPart(input.targetKind),
    normalizeIdPart(input.targetId),
    normalizeIdPart(input.ownerKind),
    normalizeIdPart(input.ownerId ?? input.ownerPath ?? "unknown"),
    normalizeIdPart(input.reasonKey ?? "default"),
  ].join(":");
}

export function stylesheetOwnershipEvidenceId(input: { stylesheetId: string }): string {
  return `ownership:stylesheet:${normalizeIdPart(input.stylesheetId)}`;
}

export function styleClassificationEvidenceId(input: {
  targetKind: OwnershipClassificationTargetKind;
  targetId: string;
  classification: OwnershipClassification;
  className?: string;
}): string {
  return [
    "ownership:classification",
    normalizeIdPart(input.targetKind),
    normalizeIdPart(input.targetId),
    normalizeIdPart(input.classification),
    normalizeIdPart(input.className ?? "no-class"),
  ].join(":");
}

export function ownershipInferenceDiagnosticId(input: {
  targetKind: OwnershipDiagnosticTargetKind;
  targetId: string;
  code: string;
}): string {
  return [
    "ownership:diagnostic",
    normalizeIdPart(input.targetKind),
    normalizeIdPart(input.targetId),
    normalizeIdPart(input.code),
  ].join(":");
}

function normalizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:/-]+/g, "-");
}
