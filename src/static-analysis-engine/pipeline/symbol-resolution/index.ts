export { collectExportedExpressionBindings } from "./collectExportedExpressionBindings.js";
export { collectTopLevelSymbols, createSymbolId } from "./collection/collectTopLevelSymbols.js";
export { buildProjectBindingResolution } from "./assembly/buildProjectBindingResolution.js";
export {
  getSymbol,
  resolveCssModuleMember,
  resolveCssModuleMemberAccess,
  resolveCssModuleNamespace,
  resolveExportedTypeDeclaration,
  resolveExportedTypeBinding,
  resolveTypeDeclaration,
  resolveTypeBinding,
} from "./api/getSymbolResolution.js";
export type { ResolvedTypeDeclaration } from "./api/getSymbolResolution.js";
export { resolveImportedBindingsForFile } from "./value-resolution/resolveImportedBindings.js";
export { resolveNamespaceImportsForFile } from "./value-resolution/resolveNamespaceImports.js";
export type {
  EngineSymbol,
  ProjectBindingResolution,
  ResolvedCssModuleBindingDiagnostic,
  ResolvedCssModuleImport,
  ResolvedCssModuleMemberAccessResult,
  ResolvedCssModuleMemberBinding,
  ResolvedCssModuleMemberReference,
  ResolvedCssModuleNamespaceBinding,
  ResolvedImportedBinding,
  ResolvedNamespaceMemberResult,
  ResolvedNamespaceImport,
  ResolvedProjectExport,
  ResolvedTypeBinding,
  SymbolSpace,
  SymbolResolutionReason,
  SymbolKind,
} from "./types.js";
