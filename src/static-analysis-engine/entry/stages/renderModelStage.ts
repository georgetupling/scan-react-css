import { buildRenderModel } from "../../pipeline/render-model/index.js";
import type {
  ParsedProjectFile,
  ProjectResolutionStageResult,
  RenderModelStageResult,
  SymbolResolutionStageResult,
} from "./types.js";

export function runRenderModelStage(input: {
  parsedFiles: ParsedProjectFile[];
  symbolResolution: SymbolResolutionStageResult;
  projectResolution: ProjectResolutionStageResult["projectResolution"];
  includeTraces?: boolean;
}): RenderModelStageResult {
  return buildRenderModel(input);
}
