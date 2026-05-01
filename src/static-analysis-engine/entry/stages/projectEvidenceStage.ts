import {
  buildProjectEvidenceAssembly,
  type BuildProjectEvidenceAssemblyInput,
} from "../../pipeline/project-evidence/index.js";
import type { ProjectEvidenceStageResult } from "./types.js";

export function runProjectEvidenceStage(
  input: BuildProjectEvidenceAssemblyInput,
): ProjectEvidenceStageResult {
  return {
    projectEvidence: buildProjectEvidenceAssembly(input),
  };
}
