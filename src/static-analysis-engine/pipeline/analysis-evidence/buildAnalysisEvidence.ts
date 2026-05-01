import { buildOwnershipInference } from "../ownership-inference/index.js";
import type { ProjectEvidenceBuildInput } from "../project-evidence/index.js";
import { createEmptyIndexes, indexEntities } from "../project-evidence/index.js";
import {
  buildProjectEvidence,
  buildProjectEvidenceEntities,
  buildProjectEvidenceRelations,
} from "../project-evidence/index.js";
import type { AnalysisEvidence } from "./types.js";

export function buildAnalysisEvidence(input: ProjectEvidenceBuildInput): AnalysisEvidence {
  const includeTraces = input.includeTraces ?? true;
  const indexes = createEmptyIndexes();
  const projectEvidence = buildProjectEvidence({
    entities: buildProjectEvidenceEntities({
      projectInput: input,
      indexes,
      includeTraces,
    }),
  });
  const {
    sourceFiles,
    stylesheets,
    classReferences,
    staticallySkippedClassReferences,
    classDefinitions,
    classContexts,
    selectorQueries,
    selectorBranches,
    components,
    unsupportedClassReferences,
    cssModuleImports,
    cssModuleAliases,
    cssModuleDestructuredBindings,
    cssModuleMemberReferences,
    cssModuleReferenceDiagnostics,
  } = projectEvidence.entities;

  indexEntities({
    sourceFiles,
    stylesheets,
    classReferences,
    staticallySkippedClassReferences,
    classDefinitions,
    classContexts,
    selectorQueries,
    selectorBranches,
    components,
    unsupportedClassReferences,
    cssModuleImports,
    cssModuleAliases,
    cssModuleDestructuredBindings,
    cssModuleMemberReferences,
    cssModuleReferenceDiagnostics,
    indexes,
  });

  const projectEvidenceWithRelations = buildProjectEvidence({
    entities: projectEvidence.entities,
    relations: buildProjectEvidenceRelations({
      projectInput: input,
      entities: projectEvidence.entities,
      indexes,
      includeTraces,
    }),
  });
  const selectorReachability = input.selectorReachability ?? emptySelectorReachability();
  const ownershipInference = buildOwnershipInference({
    projectEvidence: projectEvidenceWithRelations,
    selectorReachability,
    options: {
      includeTraces,
      sharedCssPatterns: [],
    },
  });

  return {
    projectEvidence: projectEvidenceWithRelations,
    selectorReachability,
    ownershipInference,
  };
}

function emptySelectorReachability(): NonNullable<
  ProjectEvidenceBuildInput["selectorReachability"]
> {
  return {
    meta: {
      generatedAtStage: "selector-reachability",
      selectorBranchCount: 0,
      elementMatchCount: 0,
      branchMatchCount: 0,
      diagnosticCount: 0,
    },
    selectorBranches: [],
    elementMatches: [],
    branchMatches: [],
    diagnostics: [],
    indexes: {
      branchReachabilityBySelectorBranchNodeId: new Map(),
      branchReachabilityBySourceKey: new Map(),
      matchById: new Map(),
      elementMatchById: new Map(),
      renderElementById: new Map(),
      emissionSiteById: new Map(),
      renderPathById: new Map(),
      unknownRegionById: new Map(),
      matchIdsBySelectorBranchNodeId: new Map(),
      matchIdsByElementId: new Map(),
      matchIdsByClassName: new Map(),
      matchIdsByEmissionSiteId: new Map(),
      matchIdsByRenderPathId: new Map(),
      matchIdsByPlacementConditionId: new Map(),
      renderPathIdsByElementId: new Map(),
      renderPathIdsByEmissionSiteId: new Map(),
      placementConditionIdsByElementId: new Map(),
      placementConditionIdsByEmissionSiteId: new Map(),
      emissionSiteIdsByElementId: new Map(),
      emissionSiteIdsByToken: new Map(),
      unknownClassElementIds: [],
      unknownClassEmissionSiteIds: [],
      unknownClassEmissionSiteIdsByElementId: new Map(),
      unknownRegionIdsByComponentNodeId: new Map(),
      unknownRegionIdsByRenderPathId: new Map(),
      branchIdsByRequiredClassName: new Map(),
      branchIdsByStylesheetNodeId: new Map(),
      diagnosticIdsBySelectorBranchNodeId: new Map(),
    },
  };
}
