import { buildProjectBindingResolution } from "../../pipeline/symbol-resolution/index.js";
import type { ModuleFacts } from "../../pipeline/module-facts/index.js";
import type { ParsedProjectFile, SymbolResolutionStageResult } from "./types.js";

export function runSymbolResolutionStage(input: {
  parsedFiles: ParsedProjectFile[];
  moduleFacts: ModuleFacts;
  includeTraces?: boolean;
}): SymbolResolutionStageResult {
  return buildProjectBindingResolution({
    parsedFiles: input.parsedFiles,
    moduleFacts: input.moduleFacts,
    includeTraces: input.includeTraces,
  });
}
