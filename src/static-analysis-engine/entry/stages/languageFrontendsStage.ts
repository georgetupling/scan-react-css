import { buildLanguageFrontends } from "../../pipeline/language-frontends/index.js";
import type { ProjectSnapshot } from "../../pipeline/workspace-discovery/index.js";
import type { LanguageFrontendsStageResult } from "./types.js";

export function runLanguageFrontendsStage(input: {
  snapshot: ProjectSnapshot;
}): LanguageFrontendsStageResult {
  return buildLanguageFrontends({
    snapshot: input.snapshot,
  });
}
