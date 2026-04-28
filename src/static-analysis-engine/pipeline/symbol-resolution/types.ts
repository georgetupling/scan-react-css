import ts from "typescript";

import type { AnalysisTrace } from "../../types/analysis.js";
import type { EngineModuleId, EngineSymbolId, SourceAnchor } from "../../types/core.js";

export type SymbolKind =
  | "component"
  | "function"
  | "class"
  | "constant"
  | "variable"
  | "enum"
  | "namespace"
  | "type-alias"
  | "interface"
  | "prop"
  | "imported-binding"
  | "css-resource"
  | "unknown";

export type EngineSymbol = {
  id: EngineSymbolId;
  moduleId: EngineModuleId;
  kind: SymbolKind;
  localName: string;
  exportedNames: string[];
  declaration: SourceAnchor;
  resolution:
    | { kind: "local" }
    | {
        kind: "imported";
        targetSymbolId?: EngineSymbolId;
        targetModuleId?: EngineModuleId;
        traces?: AnalysisTrace[];
      }
    | { kind: "synthetic" }
    | { kind: "unresolved"; reason: SymbolResolutionReason; traces?: AnalysisTrace[] };
  metadata?: Record<string, unknown>;
};

export type SymbolResolutionReason =
  | "target-module-not-found"
  | "export-not-found"
  | "binding-not-found"
  | "external-module"
  | "budget-exceeded"
  | "cycle-detected"
  | "ambiguous-star-export"
  | "unsupported-import-form"
  | "unresolved-imported-binding";

export type ResolvedProjectExport = {
  targetModuleId: EngineModuleId;
  targetFilePath: string;
  targetExportName: string;
  targetSymbolId?: EngineSymbolId;
};

export type ResolvedImportedBinding = {
  localName: string;
  importedName: string;
  targetModuleId: EngineModuleId;
  targetFilePath: string;
  targetExportName: string;
  targetSymbolId?: EngineSymbolId;
  traces: AnalysisTrace[];
};

export type ResolvedImportedComponentBinding = ResolvedImportedBinding;

export type ResolvedNamespaceMemberResult =
  | {
      kind: "resolved";
      target: ResolvedProjectExport;
    }
  | {
      kind: "unresolved";
      reason: SymbolResolutionReason;
      traces?: AnalysisTrace[];
    };

export type ResolvedNamespaceImport = {
  localName: string;
  members: Map<string, ResolvedNamespaceMemberResult>;
  traces: AnalysisTrace[];
};

export type ProjectBindingResolution = {
  symbols: Map<EngineSymbolId, EngineSymbol>;
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  resolvedImportedBindingsByFilePath: Map<string, ResolvedImportedBinding[]>;
  resolvedImportedComponentBindingsByFilePath: Map<string, ResolvedImportedComponentBinding[]>;
  resolvedNamespaceImportsByFilePath: Map<string, ResolvedNamespaceImport[]>;
  exportedExpressionBindingsByFilePath: Map<string, Map<string, ts.Expression>>;
  importedExpressionBindingsByFilePath: Map<string, Map<string, ts.Expression>>;
};
