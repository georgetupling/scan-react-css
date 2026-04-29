import type { ExpressionSyntaxNode, FactGraphInput } from "../types.js";
import { frontendFileProvenance } from "../provenance.js";
import { sortNodes } from "../utils/sortGraphElements.js";

export function buildExpressionSyntaxNodes(input: FactGraphInput): ExpressionSyntaxNode[] {
  const nodes: ExpressionSyntaxNode[] = [];

  for (const file of input.frontends.source.files) {
    for (const expression of file.expressionSyntax) {
      nodes.push({
        ...expression,
        id: expression.expressionId,
        kind: "expression-syntax",
        confidence: "high",
        provenance: frontendFileProvenance({
          filePath: expression.filePath,
          summary: "Extracted normalized expression syntax frontend fact",
        }),
      });
    }
  }

  return sortNodes(nodes);
}
