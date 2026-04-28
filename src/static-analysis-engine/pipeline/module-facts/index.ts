import {
  getAllResolvedModuleFacts,
  getAnalyzedModuleFilePaths,
  getDirectSourceImportFacts,
  getDirectStylesheetImportFacts,
  getResolvedModuleFacts,
} from "./api/getModuleFacts.js";
import { buildModuleFacts } from "./buildModuleFacts.js";
import { buildResolvedModuleFacts } from "./normalize/buildResolvedModuleFacts.js";
import { createModuleFactsBindingId, createModuleFactsModuleId } from "./normalize/moduleIds.js";
import {
  collectAvailableExportedNames,
  resolveModuleFactExport,
  resolveModuleFactReExportTargetFilePath,
} from "./resolve/resolveExportedName.js";
import { resolveModuleFactSourceSpecifier } from "./resolve/resolveModuleFactSourceSpecifier.js";
import { resolveSourceSpecifier } from "./resolve/resolveSourceSpecifier.js";
import { buildTypescriptResolution } from "./resolve/typescriptResolution.js";

export {
  buildModuleFacts,
  buildResolvedModuleFacts,
  buildTypescriptResolution,
  collectAvailableExportedNames,
  createModuleFactsBindingId,
  createModuleFactsModuleId,
  getAllResolvedModuleFacts,
  getAnalyzedModuleFilePaths,
  getDirectSourceImportFacts,
  getDirectStylesheetImportFacts,
  getResolvedModuleFacts,
  resolveModuleFactExport,
  resolveModuleFactReExportTargetFilePath,
  resolveModuleFactSourceSpecifier,
  resolveSourceSpecifier,
};

export type {
  ResolvedModuleFactExport,
  ResolveModuleFactExportResult,
} from "./resolve/resolveExportedName.js";
export type {
  ModuleFacts,
  ModuleFactsCacheEntry,
  ModuleFactsCaches,
  ModuleFactsConfidence,
  ModuleFactsCssSemantics,
  ModuleFactsDeclarationIndex,
  ModuleFactsExportRecord,
  ModuleFactsImportKind,
  ModuleFactsImportName,
  ModuleFactsImportRecord,
  ModuleFactsStatus,
  ModuleFactsTypescriptResolution,
  ModuleFactsValueDeclaration,
  ResolvedModuleExportFact,
  ResolvedModuleFacts,
  ResolvedModuleImportFact,
  ResolvedTopLevelBindingFact,
  WorkspacePackageEntryPoint,
} from "./types.js";
