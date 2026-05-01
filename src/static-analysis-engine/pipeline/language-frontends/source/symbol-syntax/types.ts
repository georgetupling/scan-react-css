import type { EngineModuleId, EngineSymbolId, SourceAnchor } from "../../../../types/core.js";

export type SymbolSpace = "value" | "type";
export type ScopeId = string;
export type ScopeKind = "module" | "function" | "block" | "catch" | "parameter";

export type SymbolKind =
  | "variable"
  | "function"
  | "class"
  | "interface"
  | "type-alias"
  | "enum"
  | "namespace"
  | "component"
  | "constant"
  | "prop"
  | "parameter"
  | "imported-binding";

export type SymbolResolutionReason = "binding-not-found" | "unsupported-local-alias";

export type EngineSymbol = {
  id: EngineSymbolId;
  moduleId: EngineModuleId;
  localName: string;
  symbolSpace: SymbolSpace;
  kind: SymbolKind;
  scopeId: ScopeId;
  declaration: SourceAnchor;
  exportedNames?: string[];
  resolution?: { kind: "local" | "imported" };
  metadata?: Record<string, unknown>;
};

export type SourceScope = {
  id: ScopeId;
  filePath: string;
  kind: ScopeKind;
  range: SourceAnchor;
  parentScopeId?: ScopeId;
  declaredSymbolIds: EngineSymbolId[];
  childScopeIds: ScopeId[];
};

export type SymbolReference = {
  filePath: string;
  localName: string;
  location: SourceAnchor;
  symbolSpace: SymbolSpace;
  scopeId?: ScopeId;
  resolvedSymbolId?: EngineSymbolId;
  reason?: SymbolResolutionReason;
};

export type LocalAliasResolution =
  | {
      kind: "resolved-alias";
      sourceFilePath: string;
      sourceSymbolId: EngineSymbolId;
      targetSymbolId: EngineSymbolId;
      aliasKind: "identifier" | "object-destructuring";
      location: SourceAnchor;
      memberName?: string;
    }
  | {
      kind: "unresolved-alias";
      sourceFilePath: string;
      sourceSymbolId?: EngineSymbolId;
      aliasKind: "identifier" | "object-destructuring";
      location: SourceAnchor;
      memberName?: string;
      reason:
        | "binding-not-found"
        | "self-referential-local-alias"
        | "rest-local-destructuring"
        | "nested-local-destructuring"
        | "unsupported-local-alias";
    };
