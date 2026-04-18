import type { ResolvedScanReactCssConfig } from "../../config/types.js";
import type { ProjectFactExtractionResult } from "../../facts/types.js";
import type { ExternalCssResourceNode, SourceFileNode } from "../types.js";

export function buildExternalCssResources(
  sourceFiles: SourceFileNode[],
  facts: ProjectFactExtractionResult,
  config: ResolvedScanReactCssConfig,
): ExternalCssResourceNode[] {
  const resources = new Map<string, ExternalCssResourceNode>();
  const externalFactsBySpecifier = new Map(
    facts.externalCssFacts.map((externalFact) => [externalFact.specifier, externalFact]),
  );

  for (const sourceFile of sourceFiles) {
    for (const externalImport of sourceFile.externalCssImports) {
      const existing = resources.get(externalImport.specifier);
      if (existing) {
        existing.importedBy.push(sourceFile.path);
        existing.importedBy.sort((left, right) => left.localeCompare(right));
        continue;
      }

      const externalFact = externalFactsBySpecifier.get(externalImport.specifier);
      resources.set(externalImport.specifier, {
        specifier: externalImport.specifier,
        resolvedPath:
          externalFact?.resolvedPath ?? externalImport.resolvedPath ?? externalImport.specifier,
        importedBy: [sourceFile.path],
        category: "external",
        ownership: "external",
        styleRules: [...(externalFact?.styleRules ?? [])],
        classDefinitions: [...(externalFact?.classDefinitions ?? [])],
        imports: [...(externalFact?.imports ?? [])],
      });
    }
  }

  if (config.externalCss.enabled && config.externalCss.mode === "fetch-remote") {
    for (const htmlFact of facts.htmlFacts) {
      for (const stylesheetLink of htmlFact.stylesheetLinks) {
        const externalFact = externalFactsBySpecifier.get(stylesheetLink.href);
        if (!externalFact) {
          continue;
        }

        const existing = resources.get(stylesheetLink.href);
        if (existing) {
          continue;
        }

        resources.set(stylesheetLink.href, {
          specifier: stylesheetLink.href,
          resolvedPath: externalFact.resolvedPath,
          importedBy: [],
          category: "external",
          ownership: "external",
          styleRules: [...externalFact.styleRules],
          classDefinitions: [...externalFact.classDefinitions],
          imports: [...externalFact.imports],
        });
      }
    }
  }

  return [...resources.values()].sort((left, right) =>
    left.specifier.localeCompare(right.specifier),
  );
}
