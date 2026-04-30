import type { LegacyAstExpressionStore } from "./adapters/legacyAstExpressionStore.js";
import { fallbackClassExpressionEvaluator } from "./evaluators/fallbackEvaluator.js";
import { legacyAstClassExpressionEvaluator } from "./evaluators/legacyAstEvaluator.js";
import type {
  SymbolicEvaluatorRegistry,
  SymbolicExpressionEvaluator,
  SymbolicExpressionEvaluatorInput,
  SymbolicExpressionEvaluatorResult,
} from "./types.js";

export function createDefaultSymbolicEvaluatorRegistry(input?: {
  legacyExpressionStore?: LegacyAstExpressionStore;
}): SymbolicEvaluatorRegistry {
  return createSymbolicEvaluatorRegistry(
    [
      ...(input?.legacyExpressionStore ? [legacyAstClassExpressionEvaluator] : []),
      fallbackClassExpressionEvaluator,
    ],
    input,
  );
}

export function createSymbolicEvaluatorRegistry(
  evaluators: SymbolicExpressionEvaluator[],
  context?: {
    legacyExpressionStore?: LegacyAstExpressionStore;
  },
): SymbolicEvaluatorRegistry {
  return {
    evaluate(input: SymbolicExpressionEvaluatorInput): SymbolicExpressionEvaluatorResult {
      const evaluatorInput = {
        ...input,
        ...(context?.legacyExpressionStore
          ? { legacyExpressionStore: context.legacyExpressionStore }
          : {}),
      };
      const evaluator = evaluators.find((candidate) => candidate.canEvaluate(evaluatorInput));

      if (!evaluator) {
        return {};
      }

      return evaluator.evaluate(evaluatorInput);
    },
  };
}

export { fallbackClassExpressionEvaluator, legacyAstClassExpressionEvaluator };
