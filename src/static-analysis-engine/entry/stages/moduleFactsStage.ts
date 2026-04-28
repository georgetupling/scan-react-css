import { buildModuleFacts } from "../../pipeline/module-facts/index.js";
import type { ModuleFactsStageResult, ParsedProjectFile } from "./types.js";

export function runModuleFactsStage(input: {
  parsedFiles: ParsedProjectFile[];
  stylesheetFilePaths?: Iterable<string>;
  projectRoot?: string;
}): ModuleFactsStageResult {
  return {
    moduleFacts: buildModuleFacts({
      parsedFiles: input.parsedFiles,
      stylesheetFilePaths: input.stylesheetFilePaths,
      projectRoot: input.projectRoot,
    }),
  };
}
