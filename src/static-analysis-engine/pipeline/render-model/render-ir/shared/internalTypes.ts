import ts from "typescript";

import type {
  LocalHelperDefinition,
  SameFileComponentDefinition,
} from "../collection/shared/types.js";
import type { RenderNode } from "../types.js";

export type BoundExpression = {
  kind: "bound-expression";
  expression: ts.Expression;
  context: BuildContext;
};

export type ExpressionBinding = ts.Expression | BoundExpression;

export type BuildContext = {
  filePath: string;
  parsedSourceFile: ts.SourceFile;
  currentComponentFilePath: string;
  componentsByFilePath: Map<string, Map<string, SameFileComponentDefinition>>;
  currentDepth: number;
  expansionStack: string[];
  expressionBindings: Map<string, ExpressionBinding>;
  stringSetBindings: Map<string, string[]>;
  helperDefinitions: Map<string, LocalHelperDefinition>;
  topLevelHelperDefinitionsByFilePath: Map<string, Map<string, LocalHelperDefinition>>;
  topLevelExpressionBindingsByFilePath: Map<string, Map<string, ts.Expression>>;
  namespaceExpressionBindings: Map<string, Map<string, ts.Expression>>;
  namespaceHelperDefinitions: Map<string, Map<string, LocalHelperDefinition>>;
  namespaceComponentDefinitions: Map<string, Map<string, SameFileComponentDefinition>>;
  helperExpansionStack: string[];
  propsObjectBindingName?: string;
  propsObjectProperties: Map<string, ExpressionBinding>;
  propsObjectSubtreeProperties: Map<string, RenderNode[]>;
  subtreeBindings: Map<string, RenderNode[]>;
  includeTraces: boolean;
};
