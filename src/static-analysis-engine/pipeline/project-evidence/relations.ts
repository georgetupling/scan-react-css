import { buildCssModuleMemberMatches } from "./entities/cssModules.js";
import type { ProjectEvidenceBuildInput, ProjectEvidenceBuilderIndexes } from "./analysisTypes.js";
import { buildComponentRenders, buildModuleImports } from "./relations/moduleAndComponent.js";
import {
  buildProviderBackedStylesheets,
  buildProviderClassSatisfactions,
  buildSelectorMatches,
} from "./relations/providerAndSelectorMatches.js";
import { buildReferenceMatches } from "./relations/referenceMatches.js";
import { buildStylesheetReachability } from "./relations/stylesheetReachability.js";
import type { ProjectEvidenceEntities, ProjectEvidenceRelations } from "./types.js";

export function buildProjectEvidenceRelations(input: {
  projectInput: ProjectEvidenceBuildInput;
  entities: ProjectEvidenceEntities;
  indexes: ProjectEvidenceBuilderIndexes;
  includeTraces: boolean;
  profileLogsEnabled?: boolean;
}): ProjectEvidenceRelations {
  const stylesheetReachability = measure("relations.stylesheetReachability", () =>
    buildStylesheetReachability(input.projectInput, input.indexes, input.includeTraces),
  );
  const referenceMatches = measure("relations.referenceMatches", () =>
    buildReferenceMatches({
      references: input.entities.classReferences,
      definitions: input.entities.classDefinitions,
      reachability: stylesheetReachability,
      indexes: input.indexes,
      includeTraces: input.includeTraces,
    }),
  );
  const providerClassSatisfactions = measure("relations.providerClassSatisfactions", () =>
    buildProviderClassSatisfactions({
      references: input.entities.classReferences,
      input: input.projectInput,
      includeTraces: input.includeTraces,
    }),
  );
  const providerBackedStylesheets = measure("relations.providerBackedStylesheets", () =>
    buildProviderBackedStylesheets({
      input: input.projectInput,
      indexes: input.indexes,
      includeTraces: input.includeTraces,
    }),
  );
  const selectorMatches = measure("relations.selectorMatches", () =>
    buildSelectorMatches(input.entities.selectorQueries, input.includeTraces),
  );
  const cssModuleMemberMatches = measure("relations.cssModuleMemberMatches", () =>
    buildCssModuleMemberMatches({
      references: input.entities.cssModuleMemberReferences,
      indexes: input.indexes,
      localsConvention: input.projectInput.cssModuleLocalsConvention,
      includeTraces: input.includeTraces,
    }),
  );

  return {
    moduleImports: measure("relations.moduleImports", () =>
      buildModuleImports(input.projectInput, input.indexes),
    ),
    componentRenders: measure("relations.componentRenders", () =>
      buildComponentRenders(
        input.projectInput.renderModel.renderGraph.edges,
        input.indexes,
        input.includeTraces,
      ),
    ),
    stylesheetReachability,
    referenceMatches,
    selectorMatches,
    providerClassSatisfactions,
    providerBackedStylesheets,
    cssModuleMemberMatches,
  };

  function measure<T>(label: string, run: () => T): T {
    const start = performance.now();
    const result = run();
    if (input.profileLogsEnabled) {
      console.error(
        `[profile:project-evidence] ${label}: ${(performance.now() - start).toFixed(1)}ms`,
      );
    }
    return result;
  }
}
