import type { ProjectAnalysis, ProjectAnalysisBuildInput } from "./types.js";
import {
  createEmptyIndexes,
  indexEntities,
  indexRelations,
  indexClassOwnership,
} from "./internal/indexes.js";
import {
  buildProjectEvidence,
  buildProjectEvidenceEntities,
  buildProjectEvidenceRelations,
} from "../project-evidence/index.js";
import { buildClassOwnership } from "./relations/classOwnership.js";

export function buildProjectAnalysis(input: ProjectAnalysisBuildInput): ProjectAnalysis {
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
    renderSubtrees,
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
  const {
    moduleImports,
    componentRenders,
    stylesheetReachability,
    referenceMatches,
    selectorMatches,
    providerClassSatisfactions,
    cssModuleMemberMatches,
  } = projectEvidenceWithRelations.relations;
  const classOwnership = buildClassOwnership({
    input,
    definitions: classDefinitions,
    references: classReferences,
    components,
    stylesheets,
    referenceMatches,
    indexes,
    includeTraces,
  });

  indexRelations({
    referenceMatches,
    providerClassSatisfactions,
    selectorMatches,
    cssModuleMemberMatches,
    indexes,
  });
  indexClassOwnership(classOwnership, indexes);

  return {
    meta: {
      sourceFileCount: sourceFiles.length,
      cssFileCount: stylesheets.length,
      externalCssEnabled: input.externalCssSummary.enabled,
    },
    inputs: {
      sourceFiles: sourceFiles.map(({ id, filePath }) => ({ id, filePath })),
      cssFiles: stylesheets.map(({ id, filePath }) => ({ id, filePath })),
      externalCss: input.externalCssSummary,
    },
    evidence: {
      ...(input.selectorReachability ? { selectorReachability: input.selectorReachability } : {}),
    },
    entities: {
      sourceFiles,
      stylesheets,
      classReferences,
      staticallySkippedClassReferences,
      classDefinitions,
      classContexts,
      selectorQueries,
      selectorBranches,
      classOwnership,
      components,
      renderSubtrees,
      unsupportedClassReferences,
      cssModuleImports,
      cssModuleAliases,
      cssModuleDestructuredBindings,
      cssModuleMemberReferences,
      cssModuleReferenceDiagnostics,
    },
    relations: {
      moduleImports,
      componentRenders,
      stylesheetReachability,
      referenceMatches,
      selectorMatches,
      providerClassSatisfactions,
      cssModuleMemberMatches,
    },
    indexes,
  };
}
