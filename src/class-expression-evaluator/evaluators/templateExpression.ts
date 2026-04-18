import ts from "typescript";
import type { EvaluationEnvironment, EvaluationHelpers } from "../types.js";

export function evaluateTemplateExpression(
  expression: ts.TemplateExpression,
  helpers: EvaluationHelpers,
  env: EvaluationEnvironment,
  depth: number,
) {
  const result = helpers.emptyEvaluation();
  const partialPattern = getPartialTemplatePattern(expression);

  mergeCompleteStaticSegmentTokens(
    result,
    expression.head.text,
    {
      leftBoundary: true,
      rightBoundary: false,
    },
    expression,
    helpers,
  );

  for (const [index, span] of expression.templateSpans.entries()) {
    const childResult = helpers.evaluateExpression(span.expression, env, depth + 1);
    if (childResult.tokens.length === 0 && childResult.dynamics.length === 0) {
      helpers.mergeInto(
        result,
        helpers.dynamicOnly(
          span.expression,
          "template-literal",
          "medium",
          partialPattern ? { partialTemplatePattern: partialPattern } : undefined,
        ),
      );
    } else {
      helpers.mergeInto(
        result,
        applyPartialPatternMetadata(helpers.downgradeTokensToPossible(childResult), partialPattern),
      );
    }

    mergeCompleteStaticSegmentTokens(
      result,
      span.literal.text,
      {
        leftBoundary: false,
        rightBoundary: index === expression.templateSpans.length - 1,
      },
      expression,
      helpers,
    );
  }

  return result;
}

function getPartialTemplatePattern(
  expression: ts.TemplateExpression,
): Record<string, string> | undefined {
  if (expression.templateSpans.length !== 1) {
    return undefined;
  }

  const span = expression.templateSpans[0];
  const prefix = expression.head.text;
  const suffix = span.literal.text;

  if (/\s/.test(prefix) || /\s/.test(suffix)) {
    return undefined;
  }

  if (prefix.length > 0 && suffix.length === 0 && /[A-Za-z0-9]/.test(prefix)) {
    return {
      prefix,
    };
  }

  if (prefix.length === 0 && suffix.length > 0 && /[A-Za-z0-9]/.test(suffix)) {
    return {
      suffix,
    };
  }

  return undefined;
}

function applyPartialPatternMetadata(
  result: ReturnType<EvaluationHelpers["emptyEvaluation"]>,
  partialPattern: Record<string, string> | undefined,
): ReturnType<EvaluationHelpers["emptyEvaluation"]> {
  if (!partialPattern) {
    return result;
  }

  return {
    ...result,
    dynamics: result.dynamics.map((dynamic) => ({
      ...dynamic,
      metadata: {
        ...dynamic.metadata,
        partialTemplatePattern: partialPattern,
      },
    })),
  };
}

function mergeCompleteStaticSegmentTokens(
  result: ReturnType<EvaluationHelpers["emptyEvaluation"]>,
  text: string,
  boundaries: {
    leftBoundary: boolean;
    rightBoundary: boolean;
  },
  anchorNode: ts.Node,
  helpers: EvaluationHelpers,
): void {
  for (const token of extractCompleteTokens(text, boundaries)) {
    helpers.mergeInto(
      result,
      helpers.tokenResult(token, "definite", anchorNode, "expression-evaluated", "medium", text),
    );
  }
}

function extractCompleteTokens(
  text: string,
  boundaries: {
    leftBoundary: boolean;
    rightBoundary: boolean;
  },
): string[] {
  const tokens: string[] = [];
  const tokenPattern = /\S+/g;
  let match: RegExpExecArray | null;

  tokenPattern.lastIndex = 0;

  while ((match = tokenPattern.exec(text)) !== null) {
    const token = match[0];
    const start = match.index;
    const end = start + token.length;
    const hasLeftBoundary = start > 0 || boundaries.leftBoundary;
    const hasRightBoundary = end < text.length || boundaries.rightBoundary;

    if (hasLeftBoundary && hasRightBoundary) {
      tokens.push(token);
    }
  }

  return tokens;
}
