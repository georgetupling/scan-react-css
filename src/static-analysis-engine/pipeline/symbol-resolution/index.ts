export { collectTopLevelSymbols, createSymbolId } from "./collection/collectTopLevelSymbols.js";
export { buildProjectBindingResolution } from "./assembly/buildProjectBindingResolution.js";
export { getSymbol } from "./api/getSymbol.js";
export {
  getExportedExpressionBindingsForFile,
  getImportedBindingsForFile,
  getImportedComponentBindingsForFile,
  getImportedExpressionBindingsForFile,
  getNamespaceImportsForFile,
  getSymbolResolutionFilePaths,
} from "./api/getValueResolution.js";
export {
  getCssModuleBindingsForFile,
  resolveCssModuleMember,
  resolveCssModuleMemberAccess,
  resolveCssModuleNamespace,
} from "./api/getCssModuleResolution.js";
export type { ResolvedCssModuleBindingsForFile } from "./api/getCssModuleResolution.js";
export {
  resolveExportedTypeDeclaration,
  resolveExportedTypeBinding,
  resolveTypeDeclaration,
  resolveTypeBinding,
} from "./api/getTypeResolution.js";
export type { ResolvedTypeDeclaration } from "./api/getTypeResolution.js";
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
