import ts from "typescript";
import type { SourceAnchor } from "../../../types/core.js";
import type { AnalysisTrace } from "../../../types/analysis.js";
import type { AbstractClassSet, AbstractValue } from "./types.js";

export function summarizeClassNameExpression(expression: ts.Expression): AbstractValue {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return {
      kind: "string-exact",
      value: expression.text,
    };
  }

  if (ts.isConditionalExpression(expression)) {
    const whenTrue = summarizeClassNameExpression(expression.whenTrue);
    const whenFalse = summarizeClassNameExpression(expression.whenFalse);
    const values = new Set<string>();

    for (const candidate of [whenTrue, whenFalse]) {
      if (candidate.kind === "string-exact") {
        values.add(candidate.value);
      } else if (candidate.kind === "string-set") {
        for (const value of candidate.values) {
          values.add(value);
        }
      } else {
        return { kind: "unknown", reason: "unsupported-conditional-branch" };
      }
    }

    return {
      kind: "string-set",
      values: [...values].sort((left, right) => left.localeCompare(right)),
    };
  }

  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return summarizeClassNameExpression(expression.expression);
  }

  return {
    kind: "unknown",
    reason: `unsupported-expression:${ts.SyntaxKind[expression.kind]}`,
  };
}

export function toAbstractClassSet(
  value: AbstractValue,
  sourceAnchor: SourceAnchor,
): AbstractClassSet {
  if (value.kind === "string-exact") {
    return {
      definite: tokenizeClassNames(value.value),
      possible: [],
      mutuallyExclusiveGroups: [],
      unknownDynamic: false,
      derivedFrom: [
        {
          sourceAnchor,
          description: "derived from exact string className expression",
        },
      ],
    };
  }

  if (value.kind === "string-set") {
    const allTokens = value.values.flatMap((entry) => tokenizeClassNames(entry));
    const tokenCounts = new Map<string, number>();
    for (const token of allTokens) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }

    const definite: string[] = [];
    const possible: string[] = [];
    for (const [token, count] of tokenCounts.entries()) {
      if (count === value.values.length) {
        definite.push(token);
      } else {
        possible.push(token);
      }
    }

    return {
      definite: definite.sort((left, right) => left.localeCompare(right)),
      possible: possible.sort((left, right) => left.localeCompare(right)),
      mutuallyExclusiveGroups: [],
      unknownDynamic: false,
      derivedFrom: [
        {
          sourceAnchor,
          description: "derived from bounded string-set className expression",
        },
      ],
    };
  }

  return {
    definite: [],
    possible: [],
    mutuallyExclusiveGroups: [],
    unknownDynamic: true,
    derivedFrom: [
      {
        sourceAnchor,
        description: `className expression degraded to unknown: ${value.reason}`,
      },
    ],
  };
}

export function buildClassExpressionTraces(input: {
  sourceAnchor: SourceAnchor;
  sourceText: string;
  value: AbstractValue;
}): AnalysisTrace[] {
  return [
    {
      traceId: `value-evaluation:class-expression:${input.sourceAnchor.filePath}:${input.sourceAnchor.startLine}:${input.sourceAnchor.startColumn}`,
      category: "value-evaluation",
      summary: getClassExpressionTraceSummary(input.value),
      anchor: input.sourceAnchor,
      children: [],
      metadata: {
        sourceText: input.sourceText,
        valueKind: input.value.kind,
      },
    },
  ];
}

function getClassExpressionTraceSummary(value: AbstractValue): string {
  if (value.kind === "string-exact") {
    return "className expression evaluated to an exact string";
  }

  if (value.kind === "string-set") {
    return "className expression evaluated to a bounded set of strings";
  }

  return `className expression could not be fully evaluated: ${value.reason}`;
}

function tokenizeClassNames(value: string): string[] {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}
