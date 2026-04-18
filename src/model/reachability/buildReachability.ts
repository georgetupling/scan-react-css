import type { ResolvedScanReactCssConfig } from "../../config/types.js";
import type { ProjectFactExtractionResult } from "../../facts/types.js";
import type { CssFileNode, ReachabilityInfo, SourceFileNode } from "../types.js";
import { buildImportReachability } from "./buildImportReachability.js";
import { buildRenderContextReachability } from "./buildRenderContextReachability.js";

export function buildReachability(input: {
  sourceFiles: SourceFileNode[];
  cssFiles: CssFileNode[];
  config: ResolvedScanReactCssConfig;
  facts: ProjectFactExtractionResult;
}): Map<string, ReachabilityInfo> {
  const importReachability = buildImportReachability(input);

  return buildRenderContextReachability({
    sourceFiles: input.sourceFiles,
    importReachability: importReachability.reachabilityBySourceFile,
    renderersBySourcePath: importReachability.renderersBySourcePath,
  });
}
