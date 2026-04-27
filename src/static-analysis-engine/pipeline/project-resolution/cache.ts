import type { ProjectResolutionCaches } from "./types.js";

export function createProjectResolutionCaches(): ProjectResolutionCaches {
  return {
    moduleSpecifiers: new Map(),
    importedBindings: new Map(),
    finiteTypeEvidence: new Map(),
  };
}
