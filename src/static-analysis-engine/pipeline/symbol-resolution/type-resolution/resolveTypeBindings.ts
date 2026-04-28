import { createModuleFactsModuleId } from "../../module-facts/normalize/moduleIds.js";
import {
  getAllResolvedModuleFacts,
  getResolvedModuleFacts,
  type ModuleFacts,
} from "../../module-facts/index.js";
import type { ResolvedModuleImportFact } from "../../module-facts/types.js";
import type { AnalysisTrace } from "../../../types/analysis.js";
import type { EngineSymbolId } from "../../../types/core.js";
import type { EngineSymbol, ResolvedTypeBinding, SymbolResolutionReason } from "../types.js";
import { resolveImportedModuleFactExport } from "../value-resolution/resolveProjectExport.js";

type ResolvedTypeBindingResult =
  | { kind: "resolved"; binding: ResolvedTypeBinding }
  | { kind: "unresolved"; reason: SymbolResolutionReason; traces: AnalysisTrace[] };

export function resolveImportedTypeBindingsForFile(input: {
  filePath: string;
  moduleFacts: ModuleFacts;
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  resolvedExportedTypeBindingsByFilePath: Map<string, Map<string, ResolvedTypeBinding>>;
  includeTraces?: boolean;
}): Map<string, ResolvedTypeBinding> {
  const resolvedBindings = new Map<string, ResolvedTypeBinding>();
  const moduleFacts = getResolvedModuleFacts({
    moduleFacts: input.moduleFacts,
    filePath: input.filePath,
  });
  if (!moduleFacts) {
    return resolvedBindings;
  }

  for (const importFact of moduleFacts.imports) {
    if (
      importFact.resolution.status !== "resolved" ||
      (importFact.importKind !== "source" && importFact.importKind !== "type-only")
    ) {
      continue;
    }

    for (const importedBinding of importFact.importedBindings) {
      if (!importedBinding.typeOnly || importedBinding.bindingKind !== "named") {
        continue;
      }

      const resolvedBinding = resolveImportedTypeBinding({
        importFact,
        localName: importedBinding.localName,
        importedName: importedBinding.importedName,
        moduleFacts: input.moduleFacts,
        symbolsByFilePath: input.symbolsByFilePath,
        resolvedExportedTypeBindingsByFilePath: input.resolvedExportedTypeBindingsByFilePath,
        includeTraces: input.includeTraces,
      });
      if (resolvedBinding.kind === "resolved") {
        resolvedBindings.set(importedBinding.localName, resolvedBinding.binding);
      }
    }
  }

  return resolvedBindings;
}

export function collectResolvedExportedTypeBindings(input: {
  moduleFacts: ModuleFacts;
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  includeTraces?: boolean;
}): Map<string, Map<string, ResolvedTypeBinding>> {
  const resolvedExportedTypeBindingsByFilePath = new Map<
    string,
    Map<string, ResolvedTypeBinding>
  >();

  for (const moduleFacts of getAllResolvedModuleFacts({ moduleFacts: input.moduleFacts })) {
    const resolvedBindings = new Map<string, ResolvedTypeBinding>();
    for (const exportFact of moduleFacts.exports) {
      if (
        exportFact.declarationKind !== "type" &&
        !exportFact.typeOnly &&
        exportFact.exportKind !== "default-expression"
      ) {
        continue;
      }

      const resolvedBinding = resolveExportedTypeBindingResult({
        filePath: moduleFacts.filePath,
        exportedName: exportFact.exportedName,
        moduleFacts: input.moduleFacts,
        symbolsByFilePath: input.symbolsByFilePath,
        resolvedExportedTypeBindingsByFilePath,
        includeTraces: input.includeTraces,
        visitedExports: new Set(),
        currentDepth: 0,
      });
      if (resolvedBinding.kind === "resolved") {
        resolvedBindings.set(exportFact.exportedName, resolvedBinding.binding);
      }
    }
    resolvedExportedTypeBindingsByFilePath.set(moduleFacts.filePath, resolvedBindings);
  }

  return resolvedExportedTypeBindingsByFilePath;
}

function resolveImportedTypeBinding(input: {
  importFact: ResolvedModuleImportFact;
  localName: string;
  importedName: string;
  moduleFacts: ModuleFacts;
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  resolvedExportedTypeBindingsByFilePath: Map<string, Map<string, ResolvedTypeBinding>>;
  includeTraces?: boolean;
}): ResolvedTypeBindingResult {
  const resolvedFilePath = input.importFact.resolution.resolvedFilePath;
  if (!resolvedFilePath) {
    return {
      kind: "unresolved",
      reason: "target-module-not-found",
      traces: [],
    };
  }

  const resolvedBinding = resolveExportedTypeBindingResult({
    filePath: resolvedFilePath,
    exportedName: input.importedName,
    moduleFacts: input.moduleFacts,
    symbolsByFilePath: input.symbolsByFilePath,
    resolvedExportedTypeBindingsByFilePath: input.resolvedExportedTypeBindingsByFilePath,
    includeTraces: input.includeTraces,
    visitedExports: new Set(),
    currentDepth: 0,
  });
  if (resolvedBinding.kind === "unresolved") {
    return resolvedBinding;
  }

  return {
    kind: "resolved",
    binding: {
      ...resolvedBinding.binding,
      localName: input.localName,
    },
  };
}

function resolveExportedTypeBindingResult(input: {
  filePath: string;
  exportedName: string;
  moduleFacts: ModuleFacts;
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  resolvedExportedTypeBindingsByFilePath: Map<string, Map<string, ResolvedTypeBinding>>;
  includeTraces?: boolean;
  visitedExports: Set<string>;
  currentDepth: number;
}): ResolvedTypeBindingResult {
  const cachedBinding = input.resolvedExportedTypeBindingsByFilePath
    .get(input.filePath)
    ?.get(input.exportedName);
  if (cachedBinding) {
    return { kind: "resolved", binding: cachedBinding };
  }

  const resolvedExport = resolveImportedModuleFactExport({
    filePath: input.filePath,
    exportedName: input.exportedName,
    moduleFacts: input.moduleFacts,
    symbolsByFilePath: input.symbolsByFilePath,
    visitedExports: input.visitedExports,
    currentDepth: input.currentDepth,
    includeTraces: input.includeTraces,
  });
  if (!resolvedExport.resolvedExport) {
    return {
      kind: "unresolved",
      reason: normalizeTypeResolutionReason(resolvedExport.reason),
      traces: resolvedExport.traces,
    };
  }

  const targetTypeSymbol = findResolvedTypeSymbol({
    symbolsByFilePath: input.symbolsByFilePath,
    filePath: resolvedExport.resolvedExport.targetFilePath,
    targetSymbolId: resolvedExport.resolvedExport.targetSymbolId,
    exportedName: resolvedExport.resolvedExport.targetExportName,
  });
  if (!targetTypeSymbol) {
    return {
      kind: "unresolved",
      reason: "not-a-type-symbol",
      traces: resolvedExport.traces,
    };
  }

  const binding: ResolvedTypeBinding = {
    localName: input.exportedName,
    targetModuleId:
      resolvedExport.resolvedExport.targetModuleId ??
      createModuleFactsModuleId(resolvedExport.resolvedExport.targetFilePath),
    targetFilePath: resolvedExport.resolvedExport.targetFilePath,
    targetTypeName: targetTypeSymbol.localName,
    targetSymbolId: targetTypeSymbol.id,
    traces: resolvedExport.traces,
  };

  let fileBindings = input.resolvedExportedTypeBindingsByFilePath.get(input.filePath);
  if (!fileBindings) {
    fileBindings = new Map();
    input.resolvedExportedTypeBindingsByFilePath.set(input.filePath, fileBindings);
  }
  fileBindings.set(input.exportedName, binding);

  return { kind: "resolved", binding };
}

function findResolvedTypeSymbol(input: {
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  filePath: string;
  targetSymbolId?: EngineSymbolId;
  exportedName: string;
}): EngineSymbol | undefined {
  const fileSymbols = input.symbolsByFilePath.get(input.filePath);
  if (!fileSymbols) {
    return undefined;
  }

  if (input.targetSymbolId) {
    const targetSymbol = fileSymbols.get(input.targetSymbolId);
    if (targetSymbol && isTypeSymbol(targetSymbol)) {
      return targetSymbol;
    }
  }

  for (const symbol of fileSymbols.values()) {
    if (!isTypeSymbol(symbol)) {
      continue;
    }
    if (symbol.exportedNames.includes(input.exportedName)) {
      return symbol;
    }
  }

  return undefined;
}

function isTypeSymbol(symbol: EngineSymbol): boolean {
  return symbol.kind === "type-alias" || symbol.kind === "interface";
}

function normalizeTypeResolutionReason(reason: string | undefined): SymbolResolutionReason {
  switch (reason) {
    case "target-module-not-found":
    case "export-not-found":
    case "budget-exceeded":
    case "cycle-detected":
    case "ambiguous-star-export":
      return reason;
    default:
      return "unresolved-imported-binding";
  }
}
