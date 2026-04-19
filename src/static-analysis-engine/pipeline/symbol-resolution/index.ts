export { collectTopLevelSymbols, createSymbolId } from "./collectSymbols.js";
export {
  buildProjectBindingResolution,
  resolveImportedBindingsForFile,
  resolveNamespaceImportsForFile,
} from "./resolveProjectBindings.js";
export type {
  EngineSymbol,
  ProjectBindingResolution,
  ResolvedImportedBinding,
  ResolvedNamespaceImport,
  ResolvedProjectExport,
  SymbolKind,
} from "./types.js";
