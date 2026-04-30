import { evaluateSymbolicExpressions } from "../../pipeline/symbolic-evaluation/index.js";
import type { FactGraph } from "../../pipeline/fact-graph/index.js";
import type { ParsedProjectFile, SymbolicEvaluationStageResult } from "./types.js";

export function runSymbolicEvaluationStage(input: {
  graph: FactGraph;
  parsedFiles?: ParsedProjectFile[];
  includeTraces?: boolean;
}): SymbolicEvaluationStageResult {
  return evaluateSymbolicExpressions({
    graph: input.graph,
    options: {
      includeTraces: input.includeTraces,
    },
    ...(input.parsedFiles
      ? {
          legacy: {
            parsedFiles: input.parsedFiles,
          },
        }
      : {}),
  });
}
