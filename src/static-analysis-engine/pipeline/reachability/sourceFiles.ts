import { getAnalyzedModuleFilePaths, type ModuleFacts } from "../module-facts/index.js";
import { normalizeProjectPath } from "./pathUtils.js";

export function collectAnalyzedSourceFilePaths(moduleFacts: ModuleFacts): string[] {
  return getAnalyzedModuleFilePaths({ moduleFacts })
    .map((filePath) => normalizeProjectPath(filePath) ?? filePath)
    .sort((left, right) => left.localeCompare(right));
}
