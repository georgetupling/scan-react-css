import { getAllResolvedModuleFacts, type ModuleFacts } from "../../module-facts/index.js";
import type { ResolvedCssModuleImport } from "../types.js";
import {
  createCssModuleImportKey,
  isCssModuleStylesheet,
  normalizeProjectPath,
  normalizeSegments,
  toCssModuleImportKind,
} from "./shared.js";

export function collectResolvedCssModuleImportsByFilePath(input: {
  moduleFacts: ModuleFacts;
  knownCssModuleFilePaths?: ReadonlySet<string>;
}): Map<string, ResolvedCssModuleImport[]> {
  const importsByFilePath = new Map<string, ResolvedCssModuleImport[]>();

  for (const moduleFacts of getAllResolvedModuleFacts({
    moduleFacts: input.moduleFacts,
  })) {
    const cssModuleImports: ResolvedCssModuleImport[] = [];

    for (const importFact of moduleFacts.imports) {
      if (importFact.importKind !== "css" || importFact.cssSemantics !== "module") {
        continue;
      }

      const stylesheetFilePath = resolveCssModuleImportFilePath({
        fromFilePath: moduleFacts.filePath,
        specifier: importFact.specifier,
        resolvedFilePath: importFact.resolution.resolvedFilePath,
        knownCssModuleFilePaths: input.knownCssModuleFilePaths,
      });
      if (!stylesheetFilePath) {
        continue;
      }

      for (const importedBinding of importFact.importedBindings) {
        cssModuleImports.push({
          sourceFilePath: moduleFacts.filePath,
          stylesheetFilePath,
          specifier: importFact.specifier,
          localName: importedBinding.localName,
          importKind: toCssModuleImportKind(importedBinding.bindingKind),
        });
      }
    }

    importsByFilePath.set(
      moduleFacts.filePath,
      cssModuleImports.sort((left, right) =>
        createCssModuleImportKey(left).localeCompare(createCssModuleImportKey(right)),
      ),
    );
  }

  return importsByFilePath;
}

function resolveCssModuleImportFilePath(input: {
  fromFilePath: string;
  specifier: string;
  resolvedFilePath?: string;
  knownCssModuleFilePaths?: ReadonlySet<string>;
}): string | undefined {
  if (input.resolvedFilePath && isCssModuleStylesheet(input.resolvedFilePath)) {
    return normalizeProjectPath(input.resolvedFilePath);
  }

  if (!input.knownCssModuleFilePaths) {
    return undefined;
  }

  const normalizedKnownFilePaths = new Set(
    [...input.knownCssModuleFilePaths].map((filePath) => normalizeProjectPath(filePath)),
  );
  return resolveCssModuleSpecifier({
    fromFilePath: input.fromFilePath,
    specifier: input.specifier,
    knownCssModuleFilePaths: normalizedKnownFilePaths,
  });
}

function resolveCssModuleSpecifier(input: {
  fromFilePath: string;
  specifier: string;
  knownCssModuleFilePaths: Set<string>;
}): string | undefined {
  if (!input.specifier.startsWith(".")) {
    return undefined;
  }

  const fromSegments = normalizeProjectPath(input.fromFilePath).split("/");
  fromSegments.pop();
  const baseSegments = input.specifier.split("/").filter((segment) => segment.length > 0);
  const candidateBasePath = normalizeSegments([...fromSegments, ...baseSegments]);
  const candidatePaths = [candidateBasePath, `${candidateBasePath}.css`];

  return candidatePaths.find((candidatePath) => input.knownCssModuleFilePaths.has(candidatePath));
}
