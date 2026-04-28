import { analyzeCssModules } from "../../pipeline/css-modules/index.js";
import type { CssModuleAnalysisOptions } from "../../pipeline/css-modules/index.js";
import type { ExperimentalCssFileAnalysis } from "../../pipeline/css-analysis/index.js";
import type { ModuleFacts } from "../../pipeline/module-facts/index.js";
import type { ParsedProjectFile } from "./types.js";
import type { CssModuleAnalysisStageResult } from "./types.js";

export function runCssModuleAnalysisStage(input: {
  parsedFiles: ParsedProjectFile[];
  moduleFacts: ModuleFacts;
  cssFiles: ExperimentalCssFileAnalysis[];
  options?: CssModuleAnalysisOptions;
  includeTraces?: boolean;
}): CssModuleAnalysisStageResult {
  return {
    cssModules: analyzeCssModules({
      ...input,
      moduleFacts: input.moduleFacts,
    }),
  };
}
