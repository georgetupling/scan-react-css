import type { ProjectFactExtractionResult } from "../../facts/types.js";
import type { SourceFileNode } from "../types.js";

export function buildSourceFileNodes(
  sourceFacts: ProjectFactExtractionResult["sourceFacts"],
): SourceFileNode[] {
  return sourceFacts
    .map((fact) => ({
      path: fact.filePath,
      sourceImports: fact.imports.filter((item) => item.kind === "source"),
      cssImports: fact.imports.filter((item) => item.kind === "css"),
      externalCssImports: fact.imports.filter((item) => item.kind === "external-css"),
      cssModuleImports: [...fact.cssModuleImports],
      classReferences: [...fact.classReferences],
      renderedComponents: [...fact.renderedComponents],
      helperImports: [...fact.helperImports],
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}
