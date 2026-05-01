import ts from "typescript";

import type { AnalysisTrace } from "../../../../types/analysis.js";
import type { SourceAnchor } from "../../../../types/core.js";
import type {
  ResolvedCssModuleBindingDiagnostic,
  ResolvedCssModuleBindingDiagnosticReason,
  ResolvedCssModuleNamespaceBinding,
} from "./types.js";

export function toSourceAnchor(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
): SourceAnchor {
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

export function isConstVariableDeclaration(node: ts.VariableDeclaration): boolean {
  return Boolean(
    ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0,
  );
}

export function createCssModuleTrace(input: {
  traceId: string;
  summary: string;
  anchor?: SourceAnchor;
  metadata?: Record<string, unknown>;
}): AnalysisTrace {
  return {
    traceId: input.traceId,
    category: "value-evaluation",
    summary: input.summary,
    children: [],
    ...(input.anchor ? { anchor: input.anchor } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function createCssModuleDiagnostic(input: {
  reason: ResolvedCssModuleBindingDiagnosticReason;
  node: ts.Node;
  parsedSourceFile: ts.SourceFile;
  sourceFilePath: string;
  binding: ResolvedCssModuleNamespaceBinding;
  summary: string;
  includeTraces: boolean;
}): ResolvedCssModuleBindingDiagnostic {
  const location = toSourceAnchor(input.node, input.parsedSourceFile, input.sourceFilePath);
  return {
    sourceFilePath: input.sourceFilePath,
    stylesheetFilePath: input.binding.stylesheetFilePath,
    specifier: input.binding.specifier,
    localName: input.binding.localName,
    originLocalName: input.binding.originLocalName,
    reason: input.reason,
    location,
    rawExpressionText: input.node.getText(input.parsedSourceFile),
    traces: input.includeTraces
      ? [
          createCssModuleTrace({
            traceId: `css-module:diagnostic:${location.filePath}:${location.startLine}:${location.startColumn}`,
            summary: input.summary,
            anchor: location,
            metadata: {
              stylesheetFilePath: input.binding.stylesheetFilePath,
              localName: input.binding.localName,
              reason: input.reason,
            },
          }),
        ]
      : [],
  };
}
