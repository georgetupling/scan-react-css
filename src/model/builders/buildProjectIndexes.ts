import type {
  CssFileNode,
  ExternalCssResourceNode,
  ProjectIndexes,
  ReachabilityInfo,
  SourceFileNode,
} from "../types.js";

export function buildProjectIndexes(
  sourceFiles: SourceFileNode[],
  cssFiles: CssFileNode[],
  externalCssResources: ExternalCssResourceNode[],
  activeExternalCssProviders: ProjectIndexes["activeExternalCssProviders"],
  reachability: Map<string, ReachabilityInfo>,
): ProjectIndexes {
  const sourceFileByPath = new Map(sourceFiles.map((sourceFile) => [sourceFile.path, sourceFile]));
  const cssFileByPath = new Map(cssFiles.map((cssFile) => [cssFile.path, cssFile]));
  const externalCssBySpecifier = new Map(
    externalCssResources.map((resource) => [resource.specifier, resource]),
  );
  const classDefinitionsByName = new Map<
    string,
    ProjectIndexes["classDefinitionsByName"] extends Map<string, infer V> ? V : never
  >();
  const classReferencesByName = new Map<
    string,
    ProjectIndexes["classReferencesByName"] extends Map<string, infer V> ? V : never
  >();
  const cssModuleImportsBySourceFile = new Map<string, SourceFileNode["cssModuleImports"]>();

  for (const sourceFile of sourceFiles) {
    cssModuleImportsBySourceFile.set(sourceFile.path, [...sourceFile.cssModuleImports]);

    for (const reference of sourceFile.classReferences) {
      if (!reference.className) {
        continue;
      }

      const existingReferences = classReferencesByName.get(reference.className) ?? [];
      existingReferences.push({
        sourceFile: sourceFile.path,
        reference,
      });
      existingReferences.sort((left, right) => left.sourceFile.localeCompare(right.sourceFile));
      classReferencesByName.set(reference.className, existingReferences);
    }
  }

  for (const cssFile of cssFiles) {
    for (const definition of cssFile.classDefinitions) {
      const existingDefinitions = classDefinitionsByName.get(definition.className) ?? [];
      existingDefinitions.push({
        cssFile: cssFile.path,
        ownership: cssFile.ownership,
        category: cssFile.category,
        definition,
      });
      existingDefinitions.sort((left, right) => left.cssFile.localeCompare(right.cssFile));
      classDefinitionsByName.set(definition.className, existingDefinitions);
    }
  }

  for (const externalCssResource of externalCssResources) {
    for (const definition of externalCssResource.classDefinitions) {
      const existingDefinitions = classDefinitionsByName.get(definition.className) ?? [];
      existingDefinitions.push({
        cssFile: externalCssResource.resolvedPath,
        externalSpecifier: externalCssResource.specifier,
        ownership: "external",
        category: "external",
        definition,
      });
      existingDefinitions.sort((left, right) => left.cssFile.localeCompare(right.cssFile));
      classDefinitionsByName.set(definition.className, existingDefinitions);
    }
  }

  return {
    sourceFileByPath,
    cssFileByPath,
    externalCssBySpecifier,
    activeExternalCssProviders,
    classDefinitionsByName,
    classReferencesByName,
    reachabilityBySourceFile: reachability,
    cssModuleImportsBySourceFile,
  };
}
