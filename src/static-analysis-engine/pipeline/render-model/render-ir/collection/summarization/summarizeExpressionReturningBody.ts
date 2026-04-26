import ts from "typescript";

import {
  collectLocalBodyBindings,
  isConstDeclarationList,
} from "../shared/collectLocalBodyBindings.js";
import {
  summarizeIfStatementAsExpression,
  summarizeSwitchStatementAsExpression,
} from "./statementToReturnExpression.js";

export function summarizeExpressionReturningBody(
  body: ts.ConciseBody,
  finiteStringValuesByObjectName: Map<string, Map<string, string[]>> = new Map(),
):
  | {
      returnExpression: ts.Expression;
      localExpressionBindings: Map<string, ts.Expression>;
      localStringSetBindings: Map<string, string[]>;
    }
  | undefined {
  if (!ts.isBlock(body)) {
    return {
      returnExpression: body,
      localExpressionBindings: new Map(),
      localStringSetBindings: new Map(),
    };
  }

  const localExpressionBindings = new Map<string, ts.Expression>();
  const localStringSetBindings = new Map<string, string[]>();

  for (let index = 0; index < body.statements.length; index += 1) {
    const statement = body.statements[index];

    if (ts.isVariableStatement(statement) && isConstDeclarationList(statement.declarationList)) {
      collectLocalBodyBindings(
        statement.declarationList,
        localExpressionBindings,
        localStringSetBindings,
        new Map(),
        finiteStringValuesByObjectName,
      );
      continue;
    }

    if (ts.isIfStatement(statement)) {
      const ifReturnExpression = summarizeIfStatementAsExpression(
        statement,
        body.statements.slice(index + 1),
      );
      if (ifReturnExpression) {
        return {
          returnExpression: ifReturnExpression,
          localExpressionBindings,
          localStringSetBindings,
        };
      }

      continue;
    }

    if (!ts.isReturnStatement(statement) || !statement.expression) {
      if (ts.isSwitchStatement(statement)) {
        const switchReturnExpression = summarizeSwitchStatementAsExpression(statement);
        if (switchReturnExpression) {
          return {
            returnExpression: switchReturnExpression,
            localExpressionBindings,
            localStringSetBindings,
          };
        }
      }

      continue;
    }

    return {
      returnExpression: statement.expression,
      localExpressionBindings,
      localStringSetBindings,
    };
  }

  return undefined;
}
