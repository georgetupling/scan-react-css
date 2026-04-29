import { buildRenderModel } from "../../pipeline/render-model/index.js";
import { graphToReactRenderSyntaxInputs } from "../../pipeline/fact-graph/index.js";
import type {
  FactGraphStageResult,
  ModuleFactsStageResult,
  ParsedProjectFile,
  RenderModelStageResult,
  SymbolResolutionStageResult,
} from "./types.js";

export function runRenderModelStage(input: {
  parsedFiles: ParsedProjectFile[];
  factGraph?: FactGraphStageResult;
  symbolResolution: SymbolResolutionStageResult;
  moduleFacts: ModuleFactsStageResult["moduleFacts"];
  includeTraces?: boolean;
}): RenderModelStageResult {
  return buildRenderModel({
    ...input,
    reactRenderSyntax: input.factGraph
      ? graphToReactRenderSyntaxInputs(input.factGraph.graph)
      : undefined,
  });
}
