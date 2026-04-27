import { buildProjectResolution } from "../../pipeline/project-resolution/index.js";
import type { ParsedProjectFile, ProjectResolutionStageResult } from "./types.js";

export function runProjectResolutionStage(input: {
  parsedFiles: ParsedProjectFile[];
}): ProjectResolutionStageResult {
  return {
    projectResolution: buildProjectResolution({
      parsedFiles: input.parsedFiles,
    }),
  };
}
