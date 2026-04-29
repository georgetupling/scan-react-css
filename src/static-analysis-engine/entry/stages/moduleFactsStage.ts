import { buildModuleFacts } from "../../pipeline/module-facts/index.js";
import type { ProjectResourceEdge } from "../../pipeline/workspace-discovery/index.js";
import type { ModuleFactsStageResult, ParsedProjectFile } from "./types.js";

export function runModuleFactsStage(input: {
  parsedFiles: ParsedProjectFile[];
  stylesheetFilePaths?: Iterable<string>;
  projectRoot?: string;
  resourceEdges?: ProjectResourceEdge[];
}): ModuleFactsStageResult {
  return {
    moduleFacts: buildModuleFacts({
      parsedFiles: input.parsedFiles,
      stylesheetFilePaths: input.stylesheetFilePaths,
      projectRoot: input.projectRoot,
      resourceEdges: input.resourceEdges,
    }),
  };
}
