import type {
  ClassDefinitionConsumerEvidence,
  ClassOwnershipEvidence,
  OwnershipCandidateId,
  OwnershipEvidenceId,
  OwnershipInferenceDiagnostic,
  OwnershipInferenceDiagnosticId,
  OwnershipInferenceIndexes,
  StyleClassificationEvidence,
  StyleOwnerCandidate,
  StylesheetOwnershipEvidence,
} from "./types.js";

export function buildIndexes(input: {
  classOwnership: ClassOwnershipEvidence[];
  definitionConsumers: ClassDefinitionConsumerEvidence[];
  ownerCandidates: StyleOwnerCandidate[];
  stylesheetOwnership: StylesheetOwnershipEvidence[];
  classifications: StyleClassificationEvidence[];
  diagnostics: OwnershipInferenceDiagnostic[];
}): OwnershipInferenceIndexes {
  const classOwnershipById = new Map<OwnershipEvidenceId, ClassOwnershipEvidence>();
  const classOwnershipIdsByClassDefinitionId = new Map<string, OwnershipEvidenceId[]>();
  const classOwnershipIdsByStylesheetId = new Map<string, OwnershipEvidenceId[]>();
  const classOwnershipIdsByClassName = new Map<string, OwnershipEvidenceId[]>();
  const consumerEvidenceById = new Map<OwnershipEvidenceId, ClassDefinitionConsumerEvidence>();
  const consumerEvidenceIdsByClassDefinitionId = new Map<string, OwnershipEvidenceId[]>();
  const consumerEvidenceIdsByComponentId = new Map<string, OwnershipEvidenceId[]>();
  const ownerCandidateById = new Map<OwnershipCandidateId, StyleOwnerCandidate>();
  const ownerCandidateIdsByOwnerComponentId = new Map<string, OwnershipCandidateId[]>();
  const ownerCandidateIdsByStylesheetId = new Map<string, OwnershipCandidateId[]>();
  const stylesheetOwnershipById = new Map<OwnershipEvidenceId, StylesheetOwnershipEvidence>();
  const stylesheetOwnershipByStylesheetId = new Map<string, StylesheetOwnershipEvidence>();
  const classificationById = new Map<string, StyleClassificationEvidence>();
  const classificationIdsByTargetId = new Map<string, string[]>();
  const diagnosticById = new Map<OwnershipInferenceDiagnosticId, OwnershipInferenceDiagnostic>();
  const diagnosticsByTargetId = new Map<string, OwnershipInferenceDiagnosticId[]>();

  for (const ownership of input.classOwnership) {
    classOwnershipById.set(ownership.id, ownership);
    pushMapValue(classOwnershipIdsByClassDefinitionId, ownership.classDefinitionId, ownership.id);
    pushMapValue(classOwnershipIdsByStylesheetId, ownership.stylesheetId, ownership.id);
    pushMapValue(classOwnershipIdsByClassName, ownership.className, ownership.id);
  }

  for (const consumer of input.definitionConsumers) {
    consumerEvidenceById.set(consumer.id, consumer);
    pushMapValue(consumerEvidenceIdsByClassDefinitionId, consumer.classDefinitionId, consumer.id);
    if (consumer.consumingComponentId) {
      pushMapValue(consumerEvidenceIdsByComponentId, consumer.consumingComponentId, consumer.id);
    }
    if (consumer.emittingComponentId) {
      pushMapValue(consumerEvidenceIdsByComponentId, consumer.emittingComponentId, consumer.id);
    }
    if (consumer.supplyingComponentId) {
      pushMapValue(consumerEvidenceIdsByComponentId, consumer.supplyingComponentId, consumer.id);
    }
  }

  for (const candidate of input.ownerCandidates) {
    ownerCandidateById.set(candidate.id, candidate);
    if (candidate.ownerKind === "component" && candidate.ownerId) {
      pushMapValue(ownerCandidateIdsByOwnerComponentId, candidate.ownerId, candidate.id);
    }
    if (candidate.targetKind === "stylesheet") {
      pushMapValue(ownerCandidateIdsByStylesheetId, candidate.targetId, candidate.id);
    }
  }

  for (const ownership of input.stylesheetOwnership) {
    stylesheetOwnershipById.set(ownership.id, ownership);
    stylesheetOwnershipByStylesheetId.set(ownership.stylesheetId, ownership);
  }

  for (const classification of input.classifications) {
    classificationById.set(classification.id, classification);
    pushMapValue(classificationIdsByTargetId, classification.targetId, classification.id);
  }

  for (const diagnostic of input.diagnostics) {
    diagnosticById.set(diagnostic.id, diagnostic);
    pushMapValue(diagnosticsByTargetId, diagnostic.targetId, diagnostic.id);
  }

  [
    classOwnershipIdsByClassDefinitionId,
    classOwnershipIdsByStylesheetId,
    classOwnershipIdsByClassName,
    consumerEvidenceIdsByClassDefinitionId,
    consumerEvidenceIdsByComponentId,
    ownerCandidateIdsByOwnerComponentId,
    ownerCandidateIdsByStylesheetId,
    classificationIdsByTargetId,
    diagnosticsByTargetId,
  ].forEach(sortMapValues);

  return {
    classOwnershipById,
    classOwnershipIdsByClassDefinitionId,
    classOwnershipIdsByStylesheetId,
    classOwnershipIdsByClassName,
    consumerEvidenceById,
    consumerEvidenceIdsByClassDefinitionId,
    consumerEvidenceIdsByComponentId,
    ownerCandidateById,
    ownerCandidateIdsByOwnerComponentId,
    ownerCandidateIdsByStylesheetId,
    stylesheetOwnershipById,
    stylesheetOwnershipByStylesheetId,
    classificationById,
    classificationIdsByTargetId,
    diagnosticById,
    diagnosticsByTargetId,
  };
}

function pushMapValue<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function sortMapValues(map: Map<string, string[]>): void {
  for (const [key, values] of map.entries()) {
    map.set(
      key,
      [...new Set(values)].sort((left, right) => left.localeCompare(right)),
    );
  }
}
