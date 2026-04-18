import ts from "typescript";
import {
  summarizeClassNameExpression,
  toAbstractClassSet,
} from "../abstract-values/classExpressions.js";
import type { ClassExpressionSummary, RenderNode, RenderSubtree } from "./types.js";
import type { SourceAnchor } from "../../types/core.js";

export function buildSameFileRenderSubtrees(input: {
  filePath: string;
  parsedSourceFile: ts.SourceFile;
}): RenderSubtree[] {
  const subtrees: RenderSubtree[] = [];

  for (const statement of input.parsedSourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      const rootExpression = findReturnedJsxExpression(statement.body);
      if (!rootExpression) {
        continue;
      }

      subtrees.push({
        root: buildRenderNode(rootExpression, input),
        exported: isExported(statement),
        componentName: statement.name.text,
        sourceAnchor: toSourceAnchor(statement.name, input.parsedSourceFile, input.filePath),
      });
      continue;
    }

    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }

      const componentLikeExpression = unwrapExpression(declaration.initializer);
      if (
        !ts.isArrowFunction(componentLikeExpression) &&
        !ts.isFunctionExpression(componentLikeExpression)
      ) {
        continue;
      }

      const rootExpression = findReturnedJsxExpression(componentLikeExpression.body);
      if (!rootExpression) {
        continue;
      }

      subtrees.push({
        root: buildRenderNode(rootExpression, input),
        exported: isExported(statement),
        componentName: declaration.name.text,
        sourceAnchor: toSourceAnchor(declaration.name, input.parsedSourceFile, input.filePath),
      });
    }
  }

  return subtrees;
}

function buildRenderNode(
  node: ts.Expression | ts.JsxChild,
  input: { filePath: string; parsedSourceFile: ts.SourceFile },
): RenderNode {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return buildRenderNode(node.expression, input);
  }

  if (ts.isConditionalExpression(node)) {
    return {
      kind: "conditional",
      sourceAnchor: toSourceAnchor(node, input.parsedSourceFile, input.filePath),
      conditionSourceText: node.condition.getText(input.parsedSourceFile),
      whenTrue: buildRenderNode(node.whenTrue, input),
      whenFalse: buildRenderNode(node.whenFalse, input),
    };
  }

  if (ts.isJsxElement(node)) {
    return buildElementNode(
      node.openingElement.tagName,
      node.openingElement.attributes,
      node.children,
      input,
    );
  }

  if (ts.isJsxSelfClosingElement(node)) {
    return buildElementNode(node.tagName, node.attributes, [], input);
  }

  if (ts.isJsxFragment(node)) {
    return {
      kind: "fragment",
      sourceAnchor: toSourceAnchor(node, input.parsedSourceFile, input.filePath),
      children: buildChildren(node.children, input),
    };
  }

  if (ts.isJsxExpression(node)) {
    if (!node.expression) {
      return {
        kind: "unknown",
        sourceAnchor: toSourceAnchor(node, input.parsedSourceFile, input.filePath),
        reason: "empty-jsx-expression",
      };
    }

    return buildRenderNode(node.expression, input);
  }

  if (ts.isJsxText(node)) {
    return {
      kind: "unknown",
      sourceAnchor: toSourceAnchor(node, input.parsedSourceFile, input.filePath),
      reason: "jsx-text",
    };
  }

  return {
    kind: "unknown",
    sourceAnchor: toSourceAnchor(node, input.parsedSourceFile, input.filePath),
    reason: `unsupported-render-node:${ts.SyntaxKind[node.kind]}`,
  };
}

function buildElementNode(
  tagNameNode: ts.JsxTagNameExpression,
  attributes: ts.JsxAttributes,
  children: readonly ts.JsxChild[],
  input: { filePath: string; parsedSourceFile: ts.SourceFile },
): RenderNode {
  const tagName = tagNameNode.getText(input.parsedSourceFile);
  if (!isIntrinsicTagName(tagName)) {
    return {
      kind: "component-reference",
      sourceAnchor: toSourceAnchor(tagNameNode, input.parsedSourceFile, input.filePath),
      componentName: tagName,
      reason: "local-component-expansion-not-implemented",
    };
  }

  return {
    kind: "element",
    sourceAnchor: toSourceAnchor(tagNameNode, input.parsedSourceFile, input.filePath),
    tagName,
    className: summarizeClassAttribute(attributes, input),
    children: buildChildren(children, input),
  };
}

function buildChildren(
  children: readonly ts.JsxChild[],
  input: { filePath: string; parsedSourceFile: ts.SourceFile },
): RenderNode[] {
  const results: RenderNode[] = [];

  for (const child of children) {
    if (ts.isJsxText(child) && child.getText(input.parsedSourceFile).trim() === "") {
      continue;
    }

    results.push(buildRenderNode(child, input));
  }

  return results;
}

function summarizeClassAttribute(
  attributes: ts.JsxAttributes,
  input: { filePath: string; parsedSourceFile: ts.SourceFile },
): ClassExpressionSummary | undefined {
  for (const property of attributes.properties) {
    if (
      !ts.isJsxAttribute(property) ||
      !ts.isIdentifier(property.name) ||
      property.name.text !== "className" ||
      !property.initializer
    ) {
      continue;
    }

    const expression = unwrapJsxAttributeInitializer(property.initializer);
    if (!expression) {
      return undefined;
    }

    const sourceAnchor = toSourceAnchor(expression, input.parsedSourceFile, input.filePath);
    const value = summarizeClassNameExpression(expression);

    return {
      sourceAnchor,
      value,
      classes: toAbstractClassSet(value, sourceAnchor),
      sourceText: expression.getText(input.parsedSourceFile),
    };
  }

  return undefined;
}

function findReturnedJsxExpression(body: ts.ConciseBody): ts.Expression | undefined {
  if (!ts.isBlock(body)) {
    return isRenderableExpression(body) ? body : undefined;
  }

  for (const statement of body.statements) {
    if (!ts.isReturnStatement(statement) || !statement.expression) {
      continue;
    }

    if (isRenderableExpression(statement.expression)) {
      return statement.expression;
    }
  }

  return undefined;
}

function isRenderableExpression(expression: ts.Expression): boolean {
  const unwrapped = unwrapExpression(expression);

  return (
    ts.isJsxElement(unwrapped) ||
    ts.isJsxSelfClosingElement(unwrapped) ||
    ts.isJsxFragment(unwrapped) ||
    ts.isConditionalExpression(unwrapped)
  );
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function unwrapJsxAttributeInitializer(
  initializer: ts.JsxAttribute["initializer"],
): ts.Expression | undefined {
  if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer;
  }

  if (ts.isJsxExpression(initializer)) {
    return initializer.expression ?? undefined;
  }

  return undefined;
}

function isIntrinsicTagName(tagName: string): boolean {
  const firstCharacter = tagName[0];
  return firstCharacter === firstCharacter.toLowerCase();
}

function isExported(statement: ts.Statement): boolean {
  return (
    statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
}

function toSourceAnchor(node: ts.Node, sourceFile: ts.SourceFile, filePath: string): SourceAnchor {
  const start = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
  const end = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());

  return {
    filePath,
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}
