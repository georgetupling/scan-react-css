import ts from "typescript";

import type { LocalHelperDefinition } from "../collection/shared/types.js";
import type { BoundExpression, BuildContext, ExpressionBinding } from "../shared/internalTypes.js";
import { MAX_LOCAL_HELPER_EXPANSION_DEPTH } from "../../../../libraries/policy/index.js";
import {
  buildHelperExpansionReason,
  getExpansionScope,
  type HelperExpansionReason,
} from "../shared/expansionSemantics.js";

const MAX_PROPERTY_NAME_RESOLUTION_DEPTH = 100;

type PropertyNameResolutionState = {
  activeExpressions: Set<string>;
  depth: number;
};

export function resolveBoundExpression(
  expression: ts.Expression,
  context: BuildContext,
): ts.Expression | undefined {
  return resolveBoundExpressionContext(expression, context)?.expression;
}

export function resolveBoundExpressionContext(
  expression: ts.Expression,
  context: BuildContext,
):
  | {
      expression: ts.Expression;
      context: BuildContext;
    }
  | undefined {
  if (ts.isIdentifier(expression)) {
    return unwrapExpressionBinding(context.expressionBindings.get(expression.text), context);
  }

  if (ts.isCallExpression(expression)) {
    return resolveHelperCallContext(expression, context);
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const propsObjectProperty = resolvePropsObjectPropertyAccess(expression, context);
    if (propsObjectProperty) {
      return propsObjectProperty;
    }

    const namespaceProperty = resolveNamespacePropertyAccess(expression, context);
    if (namespaceProperty) {
      return namespaceProperty;
    }

    return resolveObjectLikePropertyExpression(
      expression.expression,
      expression.name.text,
      context,
    );
  }

  if (ts.isElementAccessExpression(expression)) {
    const propertyName = resolveElementAccessPropertyName(expression.argumentExpression, context);
    if (propertyName === undefined) {
      return undefined;
    }

    return resolveObjectLikePropertyExpression(expression.expression, propertyName, context);
  }

  return undefined;
}

function resolvePropsObjectPropertyAccess(
  expression: ts.PropertyAccessExpression,
  context: BuildContext,
):
  | {
      expression: ts.Expression;
      context: BuildContext;
    }
  | undefined {
  if (
    context.propsObjectBindingName &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === context.propsObjectBindingName
  ) {
    return unwrapExpressionBinding(
      context.propsObjectProperties.get(expression.name.text),
      context,
    );
  }

  return undefined;
}

function resolveNamespacePropertyAccess(
  expression: ts.PropertyAccessExpression,
  context: BuildContext,
):
  | {
      expression: ts.Expression;
      context: BuildContext;
    }
  | undefined {
  if (ts.isIdentifier(expression.expression)) {
    return wrapExpressionBinding(
      context.namespaceExpressionBindings
        .get(expression.expression.text)
        ?.get(expression.name.text),
      context,
    );
  }

  return undefined;
}

export function resolveHelperCallExpression(
  expression: ts.CallExpression,
  context: BuildContext,
): ts.Expression | undefined {
  return resolveHelperCallContext(expression, context)?.expression;
}

export function getHelperCallResolutionFailureReason(
  expression: ts.CallExpression,
  context: BuildContext,
): HelperExpansionReason | undefined {
  const helperLookup = resolveHelperDefinitionForCall(expression, context);
  if (!helperLookup) {
    return undefined;
  }

  const { helperName, helperDefinition } = helperLookup;
  if (!helperDefinition) {
    return undefined;
  }
  const expansionScope = getExpansionScope(
    context.currentComponentFilePath,
    helperDefinition.filePath,
  );

  if (context.helperExpansionStack.includes(helperName)) {
    return buildHelperExpansionReason(expansionScope, "cycle");
  }

  if (context.helperExpansionStack.length >= MAX_LOCAL_HELPER_EXPANSION_DEPTH) {
    return buildHelperExpansionReason(expansionScope, "budgetExceeded");
  }

  if (!canBindHelperArguments(expression, helperDefinition, context)) {
    return buildHelperExpansionReason(expansionScope, "unsupportedArguments");
  }

  return undefined;
}

export function resolveHelperCallContext(
  expression: ts.CallExpression,
  context: BuildContext,
):
  | {
      expression: ts.Expression;
      context: BuildContext;
    }
  | undefined {
  const helperLookup = resolveHelperDefinitionForCall(expression, context);
  if (!helperLookup) {
    return undefined;
  }

  const { helperName, helperDefinition } = helperLookup;
  if (!helperDefinition) {
    return undefined;
  }

  if (context.helperExpansionStack.includes(helperName)) {
    return undefined;
  }

  if (context.helperExpansionStack.length >= MAX_LOCAL_HELPER_EXPANSION_DEPTH) {
    return undefined;
  }

  if (!canBindHelperArguments(expression, helperDefinition, context)) {
    return undefined;
  }

  const helperBindings = bindHelperArguments(expression, helperDefinition, context);

  const inheritedExpressionBindings = mergeExpressionBindings(
    context.expressionBindings,
    helperBindings.expressionBindings,
  );
  const helperContext: BuildContext = {
    ...context,
    filePath: helperDefinition.filePath,
    parsedSourceFile: helperDefinition.parsedSourceFile,
    currentComponentFilePath: helperDefinition.filePath,
    expressionBindings: mergeExpressionBindings(
      inheritedExpressionBindings,
      helperDefinition.localExpressionBindings,
    ),
    stringSetBindings: mergeStringSetBindings(
      mergeStringSetBindings(context.stringSetBindings, helperBindings.stringSetBindings),
      helperDefinition.localStringSetBindings,
    ),
    namespaceExpressionBindings: context.namespaceExpressionBindings,
    namespaceHelperDefinitions: context.namespaceHelperDefinitions,
    namespaceComponentDefinitions: context.namespaceComponentDefinitions,
    helperExpansionStack: [...context.helperExpansionStack, helperName],
  };

  return {
    expression: helperDefinition.returnExpression,
    context: helperContext,
  };
}

function canBindHelperArguments(
  expression: ts.CallExpression,
  helperDefinition: LocalHelperDefinition,
  context: BuildContext,
): boolean {
  const expandedArguments = expandHelperArguments(expression.arguments, context);
  if (!expandedArguments) {
    return false;
  }

  if (helperDefinition.restParameterName) {
    return expandedArguments.length >= helperDefinition.parameterBindings.length;
  }

  return expandedArguments.length === helperDefinition.parameterBindings.length;
}

function bindHelperArguments(
  expression: ts.CallExpression,
  helperDefinition: LocalHelperDefinition,
  context: BuildContext,
): {
  expressionBindings: Map<string, ExpressionBinding>;
  stringSetBindings: Map<string, string[]>;
} {
  const helperExpressionBindings = new Map<string, ExpressionBinding>();
  const helperStringSetBindings = new Map<string, string[]>();
  const expandedArguments = expandHelperArguments(expression.arguments, context) ?? [];
  for (let index = 0; index < helperDefinition.parameterBindings.length; index += 1) {
    bindHelperArgument({
      parameterBinding: helperDefinition.parameterBindings[index],
      argument: expandedArguments[index],
      context,
      expressionBindings: helperExpressionBindings,
      stringSetBindings: helperStringSetBindings,
    });
  }

  if (helperDefinition.restParameterName) {
    const restArguments = expandedArguments.slice(helperDefinition.parameterBindings.length);
    helperExpressionBindings.set(
      helperDefinition.restParameterName,
      ts.factory.createArrayLiteralExpression(restArguments, false),
    );
  }

  return {
    expressionBindings: helperExpressionBindings,
    stringSetBindings: helperStringSetBindings,
  };
}

function bindHelperArgument(input: {
  parameterBinding: LocalHelperDefinition["parameterBindings"][number];
  argument: ts.Expression;
  context: BuildContext;
  expressionBindings: Map<string, ExpressionBinding>;
  stringSetBindings: Map<string, string[]>;
}): void {
  if (input.parameterBinding.kind === "identifier") {
    input.expressionBindings.set(
      input.parameterBinding.identifierName,
      bindExpression(input.argument, input.context),
    );
    return;
  }

  const argumentBinding = resolveBoundExpressionContext(input.argument, input.context) ?? {
    expression: input.argument,
    context: input.context,
  };
  const unwrappedArgument = unwrapResolvableExpression(argumentBinding.expression);
  if (!ts.isObjectLiteralExpression(unwrappedArgument)) {
    for (const property of input.parameterBinding.properties) {
      if (property.initializer) {
        input.expressionBindings.set(property.identifierName, property.initializer);
      }
      if (property.finiteStringValues) {
        input.stringSetBindings.set(property.identifierName, property.finiteStringValues);
      }
    }
    return;
  }

  for (const property of input.parameterBinding.properties) {
    const propertyExpression = resolveObjectLiteralPropertyExpression(
      unwrappedArgument,
      property.propertyName,
    );
    if (propertyExpression) {
      bindHelperDestructuredProperty({
        identifierName: property.identifierName,
        expression: propertyExpression,
        context: argumentBinding.context,
        expressionBindings: input.expressionBindings,
        stringSetBindings: input.stringSetBindings,
      });
      continue;
    }

    if (property.initializer) {
      input.expressionBindings.set(property.identifierName, property.initializer);
    }

    if (property.finiteStringValues) {
      input.stringSetBindings.set(property.identifierName, property.finiteStringValues);
    }
  }
}

function bindHelperDestructuredProperty(input: {
  identifierName: string;
  expression: ts.Expression;
  context: BuildContext;
  expressionBindings: Map<string, ExpressionBinding>;
  stringSetBindings: Map<string, string[]>;
}): void {
  if (ts.isIdentifier(input.expression)) {
    const stringValues = input.context.stringSetBindings.get(input.expression.text);
    if (stringValues) {
      input.stringSetBindings.set(input.identifierName, stringValues);
      return;
    }

    if (input.expression.text === input.identifierName) {
      return;
    }
  }

  if (containsIdentifier(input.expression, input.identifierName)) {
    const staticClassTokens = collectStaticStringLiteralClassTokens(input.expression);
    if (staticClassTokens.length > 0) {
      input.stringSetBindings.set(input.identifierName, [staticClassTokens.join(" ")]);
    }
    return;
  }

  input.expressionBindings.set(
    input.identifierName,
    bindExpression(input.expression, input.context),
  );
}

function containsIdentifier(node: ts.Node, identifierName: string): boolean {
  let found = false;

  function visit(current: ts.Node): void {
    if (found) {
      return;
    }

    if (ts.isIdentifier(current) && current.text === identifierName) {
      found = true;
      return;
    }

    current.forEachChild(visit);
  }

  visit(node);
  return found;
}

function collectStaticStringLiteralClassTokens(node: ts.Node): string[] {
  const tokens = new Set<string>();

  function visit(current: ts.Node): void {
    if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      for (const token of current.text.split(/\s+/)) {
        if (isLikelyClassToken(token)) {
          tokens.add(token);
        }
      }
    }

    current.forEachChild(visit);
  }

  visit(node);
  return [...tokens].sort((left, right) => left.localeCompare(right));
}

function isLikelyClassToken(value: string): boolean {
  return /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(value);
}

function expandHelperArguments(
  argumentsList: ts.NodeArray<ts.Expression>,
  context: BuildContext,
): ts.Expression[] | undefined {
  const expandedArguments: ts.Expression[] = [];
  for (const argument of argumentsList) {
    if (!ts.isSpreadElement(argument)) {
      expandedArguments.push(argument);
      continue;
    }

    const spreadExpression =
      resolveBoundExpression(argument.expression, context) ?? argument.expression;
    if (!ts.isArrayLiteralExpression(spreadExpression)) {
      return undefined;
    }

    for (const element of spreadExpression.elements) {
      if (ts.isOmittedExpression(element) || ts.isSpreadElement(element)) {
        return undefined;
      }

      expandedArguments.push(element);
    }
  }

  return expandedArguments;
}

export function mergeExpressionBindings(
  baseBindings: Map<string, ExpressionBinding>,
  localBindings: Map<string, ExpressionBinding> | Map<string, ts.Expression>,
): Map<string, ExpressionBinding> {
  const merged = new Map(baseBindings);
  for (const [identifierName, expression] of localBindings.entries()) {
    merged.set(identifierName, expression);
  }

  return merged;
}

function mergeStringSetBindings(
  baseBindings: Map<string, string[]>,
  localBindings: Map<string, string[]>,
): Map<string, string[]> {
  const merged = new Map(baseBindings);
  for (const [identifierName, values] of localBindings.entries()) {
    merged.set(identifierName, values);
  }

  return merged;
}

function resolveHelperDefinitionForCall(
  expression: ts.CallExpression,
  context: BuildContext,
):
  | {
      helperName: string;
      helperDefinition: LocalHelperDefinition;
    }
  | undefined {
  if (ts.isIdentifier(expression.expression)) {
    const helperDefinition = context.helperDefinitions.get(expression.expression.text);
    return helperDefinition
      ? {
          helperName: expression.expression.text,
          helperDefinition,
        }
      : undefined;
  }

  if (
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression)
  ) {
    const namespaceName = expression.expression.expression.text;
    const helperName = `${namespaceName}.${expression.expression.name.text}`;
    const helperDefinition = context.namespaceHelperDefinitions
      .get(namespaceName)
      ?.get(expression.expression.name.text);
    return helperDefinition ? { helperName, helperDefinition } : undefined;
  }

  return undefined;
}

export function mergeHelperDefinitions(
  baseDefinitions: Map<string, LocalHelperDefinition>,
  localDefinitions: Map<string, LocalHelperDefinition>,
): Map<string, LocalHelperDefinition> {
  const merged = new Map(baseDefinitions);
  for (const [helperName, definition] of localDefinitions.entries()) {
    merged.set(helperName, definition);
  }

  return merged;
}

function resolveObjectLikePropertyExpression(
  baseExpression: ts.Expression,
  propertyName: string,
  context: BuildContext,
):
  | {
      expression: ts.Expression;
      context: BuildContext;
    }
  | undefined {
  const resolvedBaseExpression = resolveBoundExpressionContext(baseExpression, context);
  if (!resolvedBaseExpression) {
    return undefined;
  }

  return resolvePropertyValueFromExpression(
    resolvedBaseExpression.expression,
    propertyName,
    resolvedBaseExpression.context,
  );
}

function resolvePropertyValueFromExpression(
  expression: ts.Expression,
  propertyName: string,
  context: BuildContext,
):
  | {
      expression: ts.Expression;
      context: BuildContext;
    }
  | undefined {
  const helperResolution = ts.isCallExpression(expression)
    ? resolveHelperCallContext(expression, context)
    : undefined;
  if (helperResolution) {
    return resolvePropertyValueFromExpression(
      helperResolution.expression,
      propertyName,
      helperResolution.context,
    );
  }

  const unwrappedExpression = unwrapResolvableExpression(expression);
  if (ts.isObjectLiteralExpression(unwrappedExpression)) {
    for (const property of unwrappedExpression.properties) {
      if (ts.isSpreadAssignment(property)) {
        return undefined;
      }

      if (ts.isPropertyAssignment(property)) {
        const candidateName = getObjectLiteralPropertyName(property.name);
        if (candidateName === propertyName) {
          return {
            expression: property.initializer,
            context,
          };
        }

        continue;
      }

      if (ts.isShorthandPropertyAssignment(property)) {
        if (property.name.text === propertyName) {
          return {
            expression: property.name,
            context,
          };
        }

        continue;
      }

      return undefined;
    }
  }

  return undefined;
}

export function bindExpression(expression: ts.Expression, context: BuildContext): BoundExpression {
  return {
    kind: "bound-expression",
    expression,
    context,
  };
}

function unwrapExpressionBinding(
  binding: ExpressionBinding | undefined,
  fallbackContext: BuildContext,
):
  | {
      expression: ts.Expression;
      context: BuildContext;
    }
  | undefined {
  if (!binding) {
    return undefined;
  }

  if (isBoundExpression(binding)) {
    return {
      expression: binding.expression,
      context: binding.context,
    };
  }

  return {
    expression: binding,
    context: fallbackContext,
  };
}

function wrapExpressionBinding(
  expression: ts.Expression | undefined,
  context: BuildContext,
):
  | {
      expression: ts.Expression;
      context: BuildContext;
    }
  | undefined {
  return expression
    ? {
        expression,
        context,
      }
    : undefined;
}

function isBoundExpression(binding: ExpressionBinding): binding is BoundExpression {
  return "kind" in binding && binding.kind === "bound-expression";
}

function resolveObjectLiteralPropertyExpression(
  expression: ts.ObjectLiteralExpression,
  propertyName: string,
): ts.Expression | undefined {
  for (const property of expression.properties) {
    if (ts.isSpreadAssignment(property)) {
      return undefined;
    }

    if (ts.isPropertyAssignment(property)) {
      const candidateName = getObjectLiteralPropertyName(property.name);
      if (candidateName === propertyName) {
        return property.initializer;
      }

      continue;
    }

    if (ts.isShorthandPropertyAssignment(property)) {
      if (property.name.text === propertyName) {
        return property.name;
      }

      continue;
    }

    return undefined;
  }

  return undefined;
}

function resolveElementAccessPropertyName(
  argumentExpression: ts.Expression | undefined,
  context: BuildContext,
  state: PropertyNameResolutionState = {
    activeExpressions: new Set(),
    depth: 0,
  },
): string | undefined {
  if (!argumentExpression) {
    return undefined;
  }

  if (state.depth > MAX_PROPERTY_NAME_RESOLUTION_DEPTH) {
    return undefined;
  }

  const expressionKey = getExpressionResolutionKey(argumentExpression, context);
  if (state.activeExpressions.has(expressionKey)) {
    return undefined;
  }

  state.activeExpressions.add(expressionKey);
  try {
    const helperResolution = ts.isCallExpression(argumentExpression)
      ? resolveHelperCallContext(argumentExpression, context)
      : undefined;
    if (helperResolution) {
      return resolveElementAccessPropertyName(
        helperResolution.expression,
        helperResolution.context,
        nextPropertyNameResolutionState(state),
      );
    }

    const boundExpression = resolveBoundExpression(argumentExpression, context);
    if (boundExpression) {
      return resolveElementAccessPropertyName(
        boundExpression,
        context,
        nextPropertyNameResolutionState(state),
      );
    }

    const unwrappedExpression = unwrapResolvableExpression(argumentExpression);
    if (
      ts.isStringLiteral(unwrappedExpression) ||
      ts.isNoSubstitutionTemplateLiteral(unwrappedExpression) ||
      ts.isNumericLiteral(unwrappedExpression)
    ) {
      return unwrappedExpression.text;
    }

    return undefined;
  } finally {
    state.activeExpressions.delete(expressionKey);
  }
}

function getObjectLiteralPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function unwrapResolvableExpression(expression: ts.Expression): ts.Expression {
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

function nextPropertyNameResolutionState(
  state: PropertyNameResolutionState,
): PropertyNameResolutionState {
  return {
    activeExpressions: state.activeExpressions,
    depth: state.depth + 1,
  };
}

function getExpressionResolutionKey(expression: ts.Expression, context: BuildContext): string {
  return `${context.filePath}:${expression.pos}:${expression.end}:${expression.kind}`;
}
