import ts from "typescript";

import type { AnalysisTrace } from "../../../types/analysis.js";
import type { SourceAnchor } from "../../../types/core.js";
import type {
  ResolvedCssModuleBindingDiagnostic,
  ResolvedCssModuleImport,
  ResolvedCssModuleMemberBinding,
  ResolvedCssModuleMemberReference,
  ResolvedCssModuleNamespaceBinding,
} from "../types.js";

export function createCssModuleDiagnostic(input: {
  reason: ResolvedCssModuleBindingDiagnostic["reason"];
  node: ts.Node;
  parsedSourceFile: ts.SourceFile;
  sourceFilePath: string;
  binding: Pick<
    ResolvedCssModuleNamespaceBinding,
    "stylesheetFilePath" | "specifier" | "localName" | "originLocalName"
  >;
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
            traceId: `css-module:diagnostic:${input.reason}:${location.filePath}:${location.startLine}:${location.startColumn}`,
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

export function toCssModuleImportKind(
  bindingKind: "default" | "named" | "namespace",
): ResolvedCssModuleImport["importKind"] {
  if (bindingKind === "default") {
    return "default";
  }

  return bindingKind === "namespace" ? "namespace" : "named";
}

export function createCssModuleImportKey(binding: ResolvedCssModuleImport): string {
  return [binding.sourceFilePath, binding.stylesheetFilePath, binding.localName].join(":");
}

export function createCssModuleMemberBindingKey(binding: ResolvedCssModuleMemberBinding): string {
  return [
    binding.sourceFilePath,
    binding.stylesheetFilePath,
    binding.memberName,
    binding.localName,
    binding.location.startLine,
    binding.location.startColumn,
  ].join(":");
}

export function createCssModuleMemberReferenceKey(
  reference: ResolvedCssModuleMemberReference,
): string {
  return [
    reference.sourceFilePath,
    reference.stylesheetFilePath,
    reference.memberName,
    reference.accessKind,
    reference.location.startLine,
    reference.location.startColumn,
  ].join(":");
}

export function createCssModuleDiagnosticKey(
  diagnostic: ResolvedCssModuleBindingDiagnostic,
): string {
  return [
    diagnostic.sourceFilePath,
    diagnostic.stylesheetFilePath,
    diagnostic.reason,
    diagnostic.location.startLine,
    diagnostic.location.startColumn,
  ].join(":");
}

export function deduplicateByKey<T>(entries: T[], createKey: (entry: T) => string): T[] {
  return [...new Map(entries.map((entry) => [createKey(entry), entry])).values()];
}

export function isConstVariableDeclaration(node: ts.VariableDeclaration): boolean {
  return (
    ts.isVariableDeclarationList(node.parent) &&
    (node.parent.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const
  );
}

export function findImportBindingAnchor(
  sourceFile: ts.SourceFile,
  filePath: string,
  localName: string,
): SourceAnchor | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      continue;
    }

    const importClause = statement.importClause;
    if (importClause.name?.text === localName) {
      return toSourceAnchor(importClause.name, sourceFile, filePath);
    }

    if (!importClause.namedBindings) {
      continue;
    }

    if (ts.isNamespaceImport(importClause.namedBindings)) {
      if (importClause.namedBindings.name.text === localName) {
        return toSourceAnchor(importClause.namedBindings.name, sourceFile, filePath);
      }
      continue;
    }

    for (const element of importClause.namedBindings.elements) {
      if (element.name.text === localName) {
        return toSourceAnchor(element.name, sourceFile, filePath);
      }
    }
  }

  return undefined;
}

export function normalizeProjectPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function normalizeSegments(segments: string[]): string {
  const normalized: string[] = [];

  for (const segment of segments) {
    if (segment === ".") {
      continue;
    }

    if (segment === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized.join("/");
}

export function isCssModuleStylesheet(filePath: string | undefined): boolean {
  return Boolean(filePath?.match(/\.module\.[cm]?css$/i));
}

export function toSourceAnchor(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
): SourceAnchor {
  const start = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
  const end = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
  return {
    filePath: normalizeProjectPath(filePath),
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

export function createCssModuleTrace(input: {
  traceId: string;
  summary: string;
  anchor: SourceAnchor;
  metadata: Record<string, unknown>;
}): AnalysisTrace {
  return {
    traceId: input.traceId,
    category: "value-evaluation",
    summary: input.summary,
    anchor: input.anchor,
    children: [],
    metadata: input.metadata,
  };
}
