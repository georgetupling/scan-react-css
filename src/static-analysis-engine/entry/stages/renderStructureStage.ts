import { buildRenderStructure } from "../../pipeline/render-structure/index.js";
import type {
  FactGraphStageResult,
  ModuleFactsStageResult,
  ParsedProjectFile,
  RenderStructureStageResult,
  SymbolResolutionStageResult,
  SymbolicEvaluationStageResult,
} from "./types.js";

export function runRenderStructureStage(input: {
  factGraph: FactGraphStageResult;
  symbolicEvaluation: SymbolicEvaluationStageResult;
  parsedFiles: ParsedProjectFile[];
  moduleFacts: ModuleFactsStageResult["moduleFacts"];
  symbolResolution: SymbolResolutionStageResult;
  includeTraces?: boolean;
}): RenderStructureStageResult {
  return buildRenderStructure({
    graph: input.factGraph.graph,
    symbolicEvaluation: input.symbolicEvaluation,
    options: {
      includeTraces: input.includeTraces,
    },
    legacy: {
      parsedFiles: input.parsedFiles,
      moduleFacts: input.moduleFacts,
      symbolResolution: input.symbolResolution,
    },
  });
}
