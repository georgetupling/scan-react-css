import { buildIndexes } from "./indexes.js";
import { ownershipEvidenceFromClassOwnershipAnalysis } from "./projectAnalysisAdapter.js";
import { applyConsumerSummariesToClassOwnership, buildDefinitionConsumers } from "./consumers.js";
import { buildStylesheetOwnership } from "./stylesheets.js";
import { buildClassOwnership } from "../project-analysis/relations/classOwnership.js";
import type { ProjectEvidenceAssemblyResult } from "../project-evidence/index.js";
import type {
  ClassOwnershipAnalysis,
  ProjectAnalysisBuildInput,
  ProjectAnalysisIndexes,
} from "../project-analysis/index.js";
import type { SelectorReachabilityResult } from "../selector-reachability/index.js";
import type { OwnershipInferenceResult } from "./types.js";

export type OwnershipInferenceInput = {
  projectEvidence: ProjectEvidenceAssemblyResult;
  selectorReachability: SelectorReachabilityResult;
  options?: OwnershipInferenceOptions;
  compatibility?: OwnershipInferenceCompatibilityInput;
};

export type OwnershipInferenceOptions = {
  sharedCssPatterns?: string[];
  includeTraces?: boolean;
};

export type OwnershipInferenceCompatibilityInput = {
  projectInput?: ProjectAnalysisBuildInput;
  projectIndexes?: ProjectAnalysisIndexes;
  classOwnership?: ClassOwnershipAnalysis[];
};

export function buildOwnershipInference(input: OwnershipInferenceInput): OwnershipInferenceResult {
  void input.selectorReachability;

  const legacyClassOwnership =
    input.compatibility?.classOwnership ??
    buildCompatibilityClassOwnership({
      projectEvidence: input.projectEvidence,
      compatibility: input.compatibility,
      includeTraces: input.options?.includeTraces ?? true,
    });
  const ownershipEvidence = ownershipEvidenceFromClassOwnershipAnalysis(legacyClassOwnership);
  const definitionConsumers = buildDefinitionConsumers({
    projectEvidence: input.projectEvidence,
    selectorReachability: input.selectorReachability,
  });
  const classOwnership = applyConsumerSummariesToClassOwnership({
    classOwnership: ownershipEvidence.classOwnership,
    definitionConsumers,
  });
  const stylesheetEvidence = buildStylesheetOwnership({
    projectEvidence: input.projectEvidence,
    options: input.options,
  });
  const ownerCandidates = [
    ...ownershipEvidence.ownerCandidates,
    ...stylesheetEvidence.ownerCandidates,
  ].sort((left, right) => left.id.localeCompare(right.id));
  const stylesheetOwnership = stylesheetEvidence.stylesheetOwnership;
  const classifications = stylesheetEvidence.classifications;
  const diagnostics: OwnershipInferenceResult["diagnostics"] = [];

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

function buildCompatibilityClassOwnership(input: {
  projectEvidence: ProjectEvidenceAssemblyResult;
  compatibility: OwnershipInferenceCompatibilityInput | undefined;
  includeTraces: boolean;
}): ClassOwnershipAnalysis[] {
  if (!input.compatibility?.projectInput || !input.compatibility.projectIndexes) {
    return [];
  }

  return buildClassOwnership({
    input: input.compatibility.projectInput,
    definitions: input.projectEvidence.entities.classDefinitions,
    references: input.projectEvidence.entities.classReferences,
    components: input.projectEvidence.entities.components,
    stylesheets: input.projectEvidence.entities.stylesheets,
    referenceMatches: input.projectEvidence.relations.referenceMatches,
    indexes: input.compatibility.projectIndexes,
    includeTraces: input.includeTraces,
  });
}
