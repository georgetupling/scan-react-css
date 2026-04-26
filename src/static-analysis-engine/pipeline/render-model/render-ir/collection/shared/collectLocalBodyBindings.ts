import ts from "typescript";

import type { LocalHelperDefinition } from "./types.js";
import { summarizeFunctionExpressionHelperDefinition } from "../summarization/summarizeLocalHelperDefinition.js";

export function collectLocalBodyBindings(
  declarationList: ts.VariableDeclarationList,
  bindings: Map<string, ts.Expression>,
  stringSetBindings: Map<string, string[]>,
  localHelperDefinitions: Map<string, LocalHelperDefinition>,
  finiteStringValuesByObjectName: Map<string, Map<string, string[]>> = new Map(),
): void {
  for (const declaration of declarationList.declarations) {
    if (!declaration.initializer) {
      continue;
    }

    if (ts.isObjectBindingPattern(declaration.name)) {
      collectDestructuredStringSetBindings(
        declaration.name,
        declaration.initializer,
        stringSetBindings,
        finiteStringValuesByObjectName,
      );
      continue;
    }

    if (!ts.isIdentifier(declaration.name)) {
      continue;
    }

    const helperDefinition = summarizeFunctionExpressionHelperDefinition(
      declaration.name.text,
      declaration.getSourceFile().fileName,
      declaration.getSourceFile(),
      declaration.initializer,
    );
    if (helperDefinition) {
      localHelperDefinitions.set(helperDefinition.helperName, helperDefinition);
      continue;
    }

    bindings.set(declaration.name.text, declaration.initializer);
  }
}

export function isConstDeclarationList(declarationList: ts.VariableDeclarationList): boolean {
  return (declarationList.flags & ts.NodeFlags.Const) !== 0;
}

function collectDestructuredStringSetBindings(
  pattern: ts.ObjectBindingPattern,
  initializer: ts.Expression,
  stringSetBindings: Map<string, string[]>,
  finiteStringValuesByObjectName: Map<string, Map<string, string[]>>,
): void {
  if (!ts.isIdentifier(initializer)) {
    return;
  }

  const finiteStringValuesByProperty = finiteStringValuesByObjectName.get(initializer.text);
  if (!finiteStringValuesByProperty) {
    return;
  }

  for (const element of pattern.elements) {
    if (element.dotDotDotToken || !ts.isIdentifier(element.name)) {
      continue;
    }

    const propertyNameNode = element.propertyName;
    if (
      propertyNameNode &&
      !ts.isIdentifier(propertyNameNode) &&
      !ts.isStringLiteral(propertyNameNode)
    ) {
      continue;
    }

    const propertyName = propertyNameNode?.text ?? element.name.text;
    const values = finiteStringValuesByProperty.get(propertyName);
    if (values) {
      stringSetBindings.set(element.name.text, values);
    }
  }
}
