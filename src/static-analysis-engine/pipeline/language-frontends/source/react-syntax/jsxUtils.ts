import ts from "typescript";

export function getJsxTagName(node: ts.Node): string | undefined {
  if (ts.isJsxElement(node)) {
    return node.openingElement.tagName.getText(node.getSourceFile());
  }
  if (ts.isJsxSelfClosingElement(node)) {
    return node.tagName.getText(node.getSourceFile());
  }
  return undefined;
}

export function isIntrinsicTagName(tagName: string): boolean {
  return /^[a-z]/.test(tagName);
}

export function isHelperReturnStatement(node: ts.Node): node is ts.ReturnStatement {
  return (
    ts.isReturnStatement(node) && Boolean(node.expression && isJsxLikeExpression(node.expression))
  );
}

export function isJsxLikeExpression(expression: ts.Expression): boolean {
  return (
    ts.isJsxElement(expression) ||
    ts.isJsxSelfClosingElement(expression) ||
    ts.isJsxFragment(expression) ||
    ts.isConditionalExpression(expression)
  );
}

export function unwrapJsxAttributeInitializer(
  initializer: ts.JsxAttribute["initializer"],
): ts.Expression | undefined {
  if (!initializer) {
    return undefined;
  }

  if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer;
  }

  if (ts.isJsxExpression(initializer)) {
    return initializer.expression ?? undefined;
  }

  if (
    ts.isJsxElement(initializer) ||
    ts.isJsxSelfClosingElement(initializer) ||
    ts.isJsxFragment(initializer)
  ) {
    return initializer;
  }

  return undefined;
}
