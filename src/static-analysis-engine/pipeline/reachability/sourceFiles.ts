import { getAnalyzedModuleFilePaths, type ModuleFacts } from "../module-facts/index.js";
import { normalizeProjectPath } from "./pathUtils.js";

export function collectAnalyzedSourceFilePaths(projectResolution: ModuleFacts): string[] {
  return getAnalyzedModuleFilePaths({ moduleFacts: projectResolution })
    .map((filePath) => normalizeProjectPath(filePath) ?? filePath)
    .sort((left, right) => left.localeCompare(right));
}
