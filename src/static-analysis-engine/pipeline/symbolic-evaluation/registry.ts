import { fallbackClassExpressionEvaluator } from "./evaluators/fallbackEvaluator.js";
import { normalizedClassExpressionEvaluator } from "./evaluators/normalizedExpressionEvaluator.js";
import { runtimeDomClassExpressionEvaluator } from "./evaluators/runtimeDomEvaluator.js";
import type {
  SymbolicEvaluatorRegistry,
  SymbolicExpressionEvaluator,
  SymbolicExpressionEvaluatorInput,
  SymbolicExpressionEvaluatorResult,
} from "./types.js";

export function createDefaultSymbolicEvaluatorRegistry(): SymbolicEvaluatorRegistry {
  return createSymbolicEvaluatorRegistry([
    runtimeDomClassExpressionEvaluator,
    normalizedClassExpressionEvaluator,
    fallbackClassExpressionEvaluator,
  ]);
}

export function createSymbolicEvaluatorRegistry(
  evaluators: SymbolicExpressionEvaluator[],
): SymbolicEvaluatorRegistry {
  return {
    evaluate(input: SymbolicExpressionEvaluatorInput): SymbolicExpressionEvaluatorResult {
      const evaluator = evaluators.find((candidate) => candidate.canEvaluate(input));

      if (!evaluator) {
        return {};
      }

      return evaluator.evaluate(input);
    },
  };
}

export {
  fallbackClassExpressionEvaluator,
  normalizedClassExpressionEvaluator,
  runtimeDomClassExpressionEvaluator,
};
