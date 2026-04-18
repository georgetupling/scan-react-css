import type { ResolvedScanReactCssConfig } from "../../config/types.js";
import type { ProjectFactExtractionResult } from "../../facts/types.js";
import type { CssFileNode, ReachabilityInfo, SourceFileNode } from "../types.js";
import { collectReachableAncestors } from "./shared.js";

export function buildImportReachability(input: {
  sourceFiles: SourceFileNode[];
  cssFiles: CssFileNode[];
  config: ResolvedScanReactCssConfig;
  facts: ProjectFactExtractionResult;
}): {
  reachabilityBySourceFile: Map<string, ReachabilityInfo>;
  renderersBySourcePath: Map<string, Set<string>>;
} {
  const { sourceFiles, cssFiles, config, facts } = input;
  const sourceFileByPath = new Map(sourceFiles.map((sourceFile) => [sourceFile.path, sourceFile]));
  const cssFileByPath = new Map(cssFiles.map((cssFile) => [cssFile.path, cssFile]));
  const importersBySourcePath = new Map<string, Set<string>>();
  const renderersBySourcePath = new Map<string, Set<string>>();
  const globalCssPaths = cssFiles
    .filter((cssFile) => cssFile.category === "global")
    .map((cssFile) => cssFile.path)
    .sort((left, right) => left.localeCompare(right));
  const projectWideExternalCssSpecifiers = getProjectWideExternalCssSpecifiers(config, facts);

  for (const sourceFile of sourceFiles) {
    for (const sourceImport of sourceFile.sourceImports) {
      const importedSourcePath = sourceImport.resolvedPath;
      if (!importedSourcePath || !sourceFileByPath.has(importedSourcePath)) {
        continue;
      }

      const importers = importersBySourcePath.get(importedSourcePath) ?? new Set<string>();
      importers.add(sourceFile.path);
      importersBySourcePath.set(importedSourcePath, importers);
    }

    for (const renderedComponent of sourceFile.renderedComponents) {
      if (!sourceFileByPath.has(renderedComponent.resolvedPath)) {
        continue;
      }

      const renderers =
        renderersBySourcePath.get(renderedComponent.resolvedPath) ?? new Set<string>();
      renderers.add(sourceFile.path);
      renderersBySourcePath.set(renderedComponent.resolvedPath, renderers);
    }
  }

  const reachabilityBySourceFile = new Map<string, ReachabilityInfo>();

  for (const sourceFile of sourceFiles) {
    const reachableSources = collectReachableAncestors(sourceFile.path, importersBySourcePath);
    const directLocalCss = collectDirectLocalCss(sourceFile, cssFileByPath);
    const importContextLocalCss = new Set<string>();
    const localCss = new Set<string>(directLocalCss);
    const externalCss = new Set<string>();

    for (const externalImport of sourceFile.externalCssImports) {
      externalCss.add(externalImport.specifier);
    }

    for (const reachableSourcePath of reachableSources) {
      const reachableSource = sourceFileByPath.get(reachableSourcePath);
      if (!reachableSource) {
        continue;
      }

      for (const cssPath of collectDirectLocalCss(reachableSource, cssFileByPath)) {
        if (!directLocalCss.has(cssPath)) {
          importContextLocalCss.add(cssPath);
          localCss.add(cssPath);
        }
      }

      for (const externalImport of reachableSource.externalCssImports) {
        externalCss.add(externalImport.specifier);
      }
    }

    for (const externalCssSpecifier of projectWideExternalCssSpecifiers) {
      externalCss.add(externalCssSpecifier);
    }

    reachabilityBySourceFile.set(sourceFile.path, {
      directLocalCss: new Set([...directLocalCss].sort((left, right) => left.localeCompare(right))),
      importContextLocalCss: new Set(
        [...importContextLocalCss].sort((left, right) => left.localeCompare(right)),
      ),
      localCss: new Set([...localCss].sort((left, right) => left.localeCompare(right))),
      renderContextDefiniteLocalCss: new Set(),
      renderContextPossibleLocalCss: new Set(),
      globalCss: new Set(globalCssPaths),
      externalCss: new Set([...externalCss].sort((left, right) => left.localeCompare(right))),
    });
  }

  return {
    reachabilityBySourceFile,
    renderersBySourcePath,
  };
}

function getProjectWideExternalCssSpecifiers(
  config: ResolvedScanReactCssConfig,
  facts: ProjectFactExtractionResult,
): string[] {
  if (!config.externalCss.enabled) {
    return [];
  }

  if (config.externalCss.mode !== "fetch-remote") {
    return [];
  }

  return [
    ...new Set(
      facts.htmlFacts
        .flatMap((htmlFact) => htmlFact.stylesheetLinks)
        .filter((stylesheetLink) => stylesheetLink.isRemote)
        .map((stylesheetLink) => stylesheetLink.href),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function collectDirectLocalCss(
  sourceFile: SourceFileNode,
  cssFileByPath: Map<string, CssFileNode>,
): Set<string> {
  const localCss = new Set<string>();

  for (const cssImport of sourceFile.cssImports) {
    const cssPath = cssImport.resolvedPath ?? cssImport.specifier;
    const cssFile = cssFileByPath.get(cssPath);
    if (!cssFile || cssFile.category === "global") {
      continue;
    }

    localCss.add(cssFile.path);
  }

  for (const cssModuleImport of sourceFile.cssModuleImports) {
    if (cssModuleImport.resolvedPath) {
      localCss.add(cssModuleImport.resolvedPath);
    }
  }

  return localCss;
}
