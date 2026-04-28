import ts from "typescript";

import type { ParsedProjectFile } from "../../../entry/stages/types.js";
import { getAllResolvedModuleFacts, type ModuleFacts } from "../../module-facts/index.js";
import { createModuleFactsModuleId } from "../../module-facts/normalize/moduleIds.js";
import type { EngineSymbolId } from "../../../types/core.js";
import { attachSymbolResolutionInternals } from "../internals.js";
import { collectExportedExpressionBindings } from "../collectExportedExpressionBindings.js";
import { collectTopLevelSymbols } from "../collection/collectTopLevelSymbols.js";
import type {
  EngineSymbol,
  ProjectBindingResolution,
  ResolvedImportedBinding,
  ResolvedNamespaceImport,
} from "../types.js";
import { collectTransitiveImportedExpressionBindings } from "./collectImportedExpressionBindings.js";
import {
  resolveImportedBindingFailureForSymbol,
  resolveImportedBindingsForFile,
} from "../value-resolution/resolveImportedBindings.js";
import { resolveNamespaceImportsForFile } from "../value-resolution/resolveNamespaceImports.js";
import {
  collectResolvedExportedTypeBindings,
  resolveImportedTypeBindingsForFile,
} from "../type-resolution/resolveTypeBindings.js";
import { collectResolvedCssModuleBindings } from "../css-module-resolution/resolveCssModuleBindings.js";

export function buildProjectBindingResolution(input: {
  parsedFiles: ParsedProjectFile[];
  moduleFacts: ModuleFacts;
  includeTraces?: boolean;
  knownCssModuleFilePaths?: ReadonlySet<string>;
}): ProjectBindingResolution {
  const includeTraces = input.includeTraces ?? true;
  const resolvedImportedBindingsByFilePath = new Map<string, ResolvedImportedBinding[]>();
  const resolvedImportedComponentBindingsByFilePath = new Map<string, ResolvedImportedBinding[]>();
  const resolvedTypeBindingsByFilePath = new Map<
    string,
    Map<string, import("../types.js").ResolvedTypeBinding>
  >();
  const resolvedNamespaceImportsByFilePath = new Map<string, ResolvedNamespaceImport[]>();
  const {
    resolvedCssModuleImportsByFilePath,
    resolvedCssModuleNamespaceBindingsByFilePath,
    resolvedCssModuleMemberBindingsByFilePath,
    resolvedCssModuleMemberReferencesByFilePath,
    resolvedCssModuleBindingDiagnosticsByFilePath,
  } = collectResolvedCssModuleBindings({
    parsedFiles: input.parsedFiles,
    moduleFacts: input.moduleFacts,
    knownCssModuleFilePaths: input.knownCssModuleFilePaths,
    includeTraces,
  });
  const symbolsByFilePath = cloneSymbolsByFilePath(
    collectProjectSymbols({
      parsedFiles: input.parsedFiles,
      moduleFacts: input.moduleFacts,
    }),
  );
  const symbols = new Map<EngineSymbolId, EngineSymbol>();
  const resolvedExportedTypeBindingsByFilePath = collectResolvedExportedTypeBindings({
    moduleFacts: input.moduleFacts,
    symbolsByFilePath,
    includeTraces,
  });
  const exportedExpressionBindingsByFilePath = new Map<string, Map<string, ts.Expression>>(
    input.parsedFiles.map((parsedFile) => [
      parsedFile.filePath,
      collectExportedExpressionBindings(parsedFile.parsedSourceFile),
    ]),
  );

  for (const moduleFacts of getAllResolvedModuleFacts({
    moduleFacts: input.moduleFacts,
  })) {
    resolvedImportedBindingsByFilePath.set(
      moduleFacts.filePath,
      resolveImportedBindingsForFile({
        filePath: moduleFacts.filePath,
        moduleFacts: input.moduleFacts,
        symbolsByFilePath,
        includeTraces,
      }),
    );
    resolvedImportedComponentBindingsByFilePath.set(
      moduleFacts.filePath,
      (resolvedImportedBindingsByFilePath.get(moduleFacts.filePath) ?? []).filter((binding) =>
        isResolvedComponentBinding(binding, symbolsByFilePath),
      ),
    );
    resolvedTypeBindingsByFilePath.set(
      moduleFacts.filePath,
      resolveImportedTypeBindingsForFile({
        filePath: moduleFacts.filePath,
        moduleFacts: input.moduleFacts,
        symbolsByFilePath,
        resolvedExportedTypeBindingsByFilePath,
        includeTraces,
      }),
    );
    resolvedNamespaceImportsByFilePath.set(
      moduleFacts.filePath,
      resolveNamespaceImportsForFile({
        filePath: moduleFacts.filePath,
        moduleFacts: input.moduleFacts,
        symbolsByFilePath,
        includeTraces,
      }),
    );

    const fileSymbols = symbolsByFilePath.get(moduleFacts.filePath);
    if (!fileSymbols) {
      continue;
    }

    const importedBindingsByLocalName = new Map(
      (resolvedImportedBindingsByFilePath.get(moduleFacts.filePath) ?? []).map((binding) => [
        binding.localName,
        binding,
      ]),
    );
    for (const [symbolId, symbol] of fileSymbols.entries()) {
      if (symbol.resolution.kind !== "imported") {
        symbols.set(symbolId, symbol);
        continue;
      }

      const resolvedBinding = importedBindingsByLocalName.get(symbol.localName);
      if (!resolvedBinding) {
        const unresolvedImportedBinding = resolveImportedBindingFailureForSymbol({
          symbol,
          moduleFacts: input.moduleFacts,
          filePath: moduleFacts.filePath,
          includeTraces,
        });
        if (unresolvedImportedBinding) {
          const enrichedSymbol: EngineSymbol = {
            ...symbol,
            resolution: {
              kind: "unresolved",
              reason: unresolvedImportedBinding.reason,
              traces: unresolvedImportedBinding.traces,
            },
          };
          fileSymbols.set(symbolId, enrichedSymbol);
          symbols.set(symbolId, enrichedSymbol);
          continue;
        }

        symbols.set(symbolId, symbol);
        continue;
      }

      const enrichedSymbol: EngineSymbol = {
        ...symbol,
        resolution: {
          kind: "imported",
          targetModuleId: resolvedBinding.targetModuleId,
          targetSymbolId: resolvedBinding.targetSymbolId,
          traces: resolvedBinding.traces,
        },
      };
      fileSymbols.set(symbolId, enrichedSymbol);
      symbols.set(symbolId, enrichedSymbol);
    }
  }

  for (const fileSymbols of symbolsByFilePath.values()) {
    for (const [symbolId, symbol] of fileSymbols.entries()) {
      if (!symbols.has(symbolId)) {
        symbols.set(symbolId, symbol);
      }
    }
  }

  return attachSymbolResolutionInternals({
    symbolResolution: {
      symbols,
    },
    internals: {
      symbolsByFilePath,
      resolvedImportedBindingsByFilePath,
      resolvedImportedComponentBindingsByFilePath,
      resolvedTypeBindingsByFilePath,
      resolvedExportedTypeBindingsByFilePath,
      resolvedNamespaceImportsByFilePath,
      resolvedCssModuleImportsByFilePath,
      resolvedCssModuleNamespaceBindingsByFilePath,
      resolvedCssModuleMemberBindingsByFilePath,
      resolvedCssModuleMemberReferencesByFilePath,
      resolvedCssModuleBindingDiagnosticsByFilePath,
      exportedExpressionBindingsByFilePath,
      importedExpressionBindingsByFilePath: new Map(
        [...symbolsByFilePath.keys()].map((filePath) => [
          filePath,
          collectTransitiveImportedExpressionBindings({
            filePath,
            resolvedImportedBindingsByFilePath,
            exportedExpressionBindingsByFilePath,
            visitedFilePaths: new Set([filePath]),
            currentDepth: 0,
          }),
        ]),
      ),
    },
  });
}

function collectProjectSymbols(input: {
  parsedFiles: ParsedProjectFile[];
  moduleFacts: ModuleFacts;
}): Map<string, Map<EngineSymbolId, EngineSymbol>> {
  return new Map(
    input.parsedFiles.map((parsedFile) => [
      parsedFile.filePath,
      collectTopLevelSymbols({
        filePath: parsedFile.filePath,
        parsedSourceFile: parsedFile.parsedSourceFile,
        moduleId: createModuleFactsModuleId(parsedFile.filePath),
        moduleFacts: input.moduleFacts,
      }),
    ]),
  );
}

function cloneSymbolsByFilePath(
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>,
): Map<string, Map<EngineSymbolId, EngineSymbol>> {
  return new Map(
    [...symbolsByFilePath.entries()].map(([filePath, fileSymbols]) => [
      filePath,
      new Map(
        [...fileSymbols.entries()].map(([symbolId, symbol]) => [
          symbolId,
          { ...symbol, resolution: { ...symbol.resolution } },
        ]),
      ),
    ]),
  );
}

function isResolvedComponentBinding(
  binding: ResolvedImportedBinding,
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>,
): boolean {
  if (!binding.targetSymbolId) {
    return false;
  }

  return (
    symbolsByFilePath.get(binding.targetFilePath)?.get(binding.targetSymbolId)?.kind === "component"
  );
}
