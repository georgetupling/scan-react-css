import { buildAnalysisEvidence } from "../../pipeline/analysis-evidence/index.js";
import type { ProjectEvidenceBuildInput } from "../../pipeline/project-evidence/index.js";
import type { AnalysisEvidenceStageResult } from "./types.js";

export function runAnalysisEvidenceStage(
  input: ProjectEvidenceBuildInput,
): AnalysisEvidenceStageResult {
  return {
    analysisEvidence: buildAnalysisEvidence(input),
  };
}
