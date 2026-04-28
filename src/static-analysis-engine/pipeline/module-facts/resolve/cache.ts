import type { ModuleFactsCaches } from "../types.js";

export function createModuleFactsCaches(): ModuleFactsCaches {
  return {
    moduleSpecifiers: new Map(),
    importedBindings: new Map(),
    finiteTypeEvidence: new Map(),
  };
}
