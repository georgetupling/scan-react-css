import type { ResolvedScanReactCssConfig } from "../../config/types.js";
import type { ProjectFactExtractionResult } from "../../facts/types.js";
import { classifyCssCategory, classifyCssOwnership } from "../classification/cssOwnership.js";
import type { CssFileNode, SourceFileNode } from "../types.js";

export function buildCssFileNodes(
  facts: ProjectFactExtractionResult,
  config: ResolvedScanReactCssConfig,
  sourceFileByPath: Map<string, SourceFileNode>,
): CssFileNode[] {
  return facts.cssFacts
    .map((fact) => {
      const ownership = classifyCssOwnership(fact.filePath, config, sourceFileByPath);
      const category = classifyCssCategory(ownership);

      return {
        path: fact.filePath,
        ownership,
        category,
        styleRules: [...fact.styleRules],
        classDefinitions: [...fact.classDefinitions],
        imports: [...fact.imports],
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}
