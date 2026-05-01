import { buildCssModuleMemberMatches } from "../project-analysis/entities/cssModules.js";
import type {
  ProjectAnalysisBuildInput,
  ProjectAnalysisIndexes,
} from "../project-analysis/index.js";
import {
  buildComponentRenders,
  buildModuleImports,
} from "../project-analysis/relations/moduleAndComponent.js";
import {
  buildProviderClassSatisfactions,
  buildSelectorMatches,
} from "../project-analysis/relations/providerAndSelectorMatches.js";
import { buildReferenceMatches } from "../project-analysis/relations/referenceMatches.js";
import { buildStylesheetReachability } from "../project-analysis/relations/stylesheetReachability.js";
import type { ProjectEvidenceEntities, ProjectEvidenceRelations } from "./types.js";

export function buildProjectEvidenceRelations(input: {
  projectInput: ProjectAnalysisBuildInput;
  entities: ProjectEvidenceEntities;
  indexes: ProjectAnalysisIndexes;
  includeTraces: boolean;
}): ProjectEvidenceRelations {
  const stylesheetReachability = buildStylesheetReachability(
    input.projectInput,
    input.indexes,
    input.includeTraces,
  );
  const referenceMatches = buildReferenceMatches({
    references: input.entities.classReferences,
    definitions: input.entities.classDefinitions,
    reachability: stylesheetReachability,
    indexes: input.indexes,
    includeTraces: input.includeTraces,
  });
  const providerClassSatisfactions = buildProviderClassSatisfactions({
    references: input.entities.classReferences,
    input: input.projectInput,
    includeTraces: input.includeTraces,
  });
  const selectorMatches = buildSelectorMatches(input.entities.selectorQueries, input.includeTraces);
  const cssModuleMemberMatches = buildCssModuleMemberMatches({
    references: input.entities.cssModuleMemberReferences,
    indexes: input.indexes,
    localsConvention: input.projectInput.cssModuleLocalsConvention,
    includeTraces: input.includeTraces,
  });

  return {
    moduleImports: buildModuleImports(input.projectInput, input.indexes),
    componentRenders: buildComponentRenders(
      input.projectInput.renderModel.renderGraph.edges,
      input.indexes,
      input.includeTraces,
    ),
    stylesheetReachability,
    referenceMatches,
    selectorMatches,
    providerClassSatisfactions,
    cssModuleMemberMatches,
  };
}
