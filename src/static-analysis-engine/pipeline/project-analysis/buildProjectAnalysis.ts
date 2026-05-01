import type { ProjectAnalysis, ProjectAnalysisBuildInput } from "./types.js";
import { buildCssModuleMemberMatches } from "./entities/cssModules.js";
import {
  createEmptyIndexes,
  indexEntities,
  indexRelations,
  indexClassOwnership,
} from "./internal/indexes.js";
import { buildProjectEvidence, buildProjectEvidenceEntities } from "../project-evidence/index.js";
import { buildStylesheetReachability } from "./relations/stylesheetReachability.js";
import { buildReferenceMatches } from "./relations/referenceMatches.js";
import {
  buildProviderClassSatisfactions,
  buildSelectorMatches,
} from "./relations/providerAndSelectorMatches.js";
import { buildClassOwnership } from "./relations/classOwnership.js";
import { buildModuleImports, buildComponentRenders } from "./relations/moduleAndComponent.js";

export function buildProjectAnalysis(input: ProjectAnalysisBuildInput): ProjectAnalysis {
  const includeTraces = input.includeTraces ?? true;
  const indexes = createEmptyIndexes();
  const renderGraph = input.renderModel.renderGraph;
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
  const stylesheetReachability = buildStylesheetReachability(input, indexes, includeTraces);
  const referenceMatches = buildReferenceMatches({
    references: classReferences,
    definitions: classDefinitions,
    reachability: stylesheetReachability,
    indexes,
    includeTraces,
  });
  const providerClassSatisfactions = buildProviderClassSatisfactions({
    references: classReferences,
    input,
    includeTraces,
  });
  const selectorMatches = buildSelectorMatches(selectorQueries, includeTraces);
  const cssModuleMemberMatches = buildCssModuleMemberMatches({
    references: cssModuleMemberReferences,
    indexes,
    localsConvention: input.cssModuleLocalsConvention,
    includeTraces,
  });
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
      moduleImports: buildModuleImports(input, indexes),
      componentRenders: buildComponentRenders(renderGraph.edges, indexes, includeTraces),
      stylesheetReachability,
      referenceMatches,
      selectorMatches,
      providerClassSatisfactions,
      cssModuleMemberMatches,
    },
    indexes,
  };
}
