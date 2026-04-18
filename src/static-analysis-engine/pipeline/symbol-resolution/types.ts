import type { EngineModuleId, EngineSymbolId, SourceAnchor } from "../../types/core.js";

export type SymbolKind =
  | "component"
  | "function"
  | "constant"
  | "variable"
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
    | { kind: "imported"; targetSymbolId?: EngineSymbolId; targetModuleId?: EngineModuleId }
    | { kind: "synthetic" }
    | { kind: "unresolved"; reason: string };
  metadata?: Record<string, unknown>;
};
