import type { EngineModuleId, EngineSymbolId } from "../../../types/core.js";
import { normalizeFilePath } from "../shared/pathUtils.js";

export function createModuleFactsModuleId(filePath: string): EngineModuleId {
  return `module:${normalizeFilePath(filePath)}`;
}

export function createModuleFactsBindingId(
  moduleId: EngineModuleId,
  localName: string,
): EngineSymbolId {
  return `symbol:${moduleId}:${localName}`;
}
