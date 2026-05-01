import { buildIndexes } from "./indexes.js";
import type {
  ClassDefinitionConsumerEvidence,
  ClassOwnershipEvidence,
  OwnershipInferenceResult,
  StyleClassificationEvidence,
  StyleOwnerCandidate,
  StylesheetOwnershipEvidence,
  OwnershipInferenceDiagnostic,
} from "./types.js";

export type OwnershipInferenceInput = {
  classOwnership?: ClassOwnershipEvidence[];
  definitionConsumers?: ClassDefinitionConsumerEvidence[];
  ownerCandidates?: StyleOwnerCandidate[];
  stylesheetOwnership?: StylesheetOwnershipEvidence[];
  classifications?: StyleClassificationEvidence[];
  diagnostics?: OwnershipInferenceDiagnostic[];
};

export function buildOwnershipInference(
  input: OwnershipInferenceInput = {},
): OwnershipInferenceResult {
  const classOwnership = [...(input.classOwnership ?? [])].sort(compareById);
  const definitionConsumers = [...(input.definitionConsumers ?? [])].sort(compareById);
  const ownerCandidates = [...(input.ownerCandidates ?? [])].sort(compareById);
  const stylesheetOwnership = [...(input.stylesheetOwnership ?? [])].sort(compareById);
  const classifications = [...(input.classifications ?? [])].sort(compareById);
  const diagnostics = [...(input.diagnostics ?? [])].sort(compareById);

  return {
    meta: {
      generatedAtStage: "ownership-inference",
      classOwnershipCount: classOwnership.length,
      definitionConsumerCount: definitionConsumers.length,
      ownerCandidateCount: ownerCandidates.length,
      stylesheetOwnershipCount: stylesheetOwnership.length,
      classificationCount: classifications.length,
      diagnosticCount: diagnostics.length,
    },
    classOwnership,
    definitionConsumers,
    ownerCandidates,
    stylesheetOwnership,
    classifications,
    diagnostics,
    indexes: buildIndexes({
      classOwnership,
      definitionConsumers,
      ownerCandidates,
      stylesheetOwnership,
      classifications,
      diagnostics,
    }),
  };
}

function compareById(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}
