import type { ProjectEvidenceBuildInput, ProjectEvidenceBuilderIndexes } from "./analysisTypes.js";
import { buildProjectEvidence } from "./buildProjectEvidence.js";
import { buildProjectEvidenceEntities } from "./entities.js";
import { buildProjectEvidenceRelations } from "./relations.js";
import { createEmptyIndexes, indexEntities } from "./internal/indexes.js";
import type { ProjectEvidenceAssemblyResult } from "./types.js";

export type BuildProjectEvidenceAssemblyInput = {
  projectInput: Omit<ProjectEvidenceBuildInput, "cssModuleLocalsConvention" | "includeTraces">;
  options?: {
    includeTraces?: boolean;
    cssModuleLocalsConvention?: ProjectEvidenceBuildInput["cssModuleLocalsConvention"];
  };
};

export function buildProjectEvidenceAssembly(
  input: BuildProjectEvidenceAssemblyInput,
): ProjectEvidenceAssemblyResult {
  const includeTraces = input.options?.includeTraces ?? true;
  const indexes = createEmptyIndexes();
  const projectInput: ProjectEvidenceBuildInput = {
    ...input.projectInput,
    cssModuleLocalsConvention: input.options?.cssModuleLocalsConvention,
    includeTraces,
  };
  const entities = buildProjectEvidenceEntities({
    projectInput,
    indexes,
    includeTraces,
  });
  indexProjectEvidenceEntities(entities, indexes);

  return buildProjectEvidence({
    entities,
    relations: buildProjectEvidenceRelations({
      projectInput,
      entities,
      indexes,
      includeTraces,
    }),
  });
}

function indexProjectEvidenceEntities(
  entities: ReturnType<typeof buildProjectEvidenceEntities>,
  indexes: ProjectEvidenceBuilderIndexes,
): void {
  indexEntities({
    sourceFiles: entities.sourceFiles,
    stylesheets: entities.stylesheets,
    classReferences: entities.classReferences,
    staticallySkippedClassReferences: entities.staticallySkippedClassReferences,
    classDefinitions: entities.classDefinitions,
    classContexts: entities.classContexts,
    selectorQueries: entities.selectorQueries,
    selectorBranches: entities.selectorBranches,
    components: entities.components,
    unsupportedClassReferences: entities.unsupportedClassReferences,
    cssModuleImports: entities.cssModuleImports,
    cssModuleAliases: entities.cssModuleAliases,
    cssModuleDestructuredBindings: entities.cssModuleDestructuredBindings,
    cssModuleMemberReferences: entities.cssModuleMemberReferences,
    cssModuleReferenceDiagnostics: entities.cssModuleReferenceDiagnostics,
    indexes,
  });
}
