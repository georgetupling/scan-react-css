import ts from "typescript";

import type {
  ProjectBindingResolution,
  ResolvedImportedBinding,
  ResolvedNamespaceImport,
} from "../types.js";
import { getSymbolResolutionInternals } from "../internals.js";

export function getSymbolResolutionFilePaths(input: {
  symbolResolution: ProjectBindingResolution;
}): string[] {
  return [...getSymbolResolutionInternals(input.symbolResolution).symbolsByFilePath.keys()];
}

export function getImportedBindingsForFile(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
}): ResolvedImportedBinding[] {
  return [
    ...(getSymbolResolutionInternals(input.symbolResolution).resolvedImportedBindingsByFilePath.get(
      input.filePath,
    ) ?? []),
  ];
}

export function getImportedComponentBindingsForFile(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
}): ResolvedImportedBinding[] {
  return [
    ...(getSymbolResolutionInternals(
      input.symbolResolution,
    ).resolvedImportedComponentBindingsByFilePath.get(input.filePath) ?? []),
  ];
}

export function getNamespaceImportsForFile(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
}): ResolvedNamespaceImport[] {
  return [
    ...(getSymbolResolutionInternals(input.symbolResolution).resolvedNamespaceImportsByFilePath.get(
      input.filePath,
    ) ?? []),
  ];
}

export function getExportedExpressionBindingsForFile(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
}): Map<string, ts.Expression> {
  return new Map(
    getSymbolResolutionInternals(input.symbolResolution).exportedExpressionBindingsByFilePath.get(
      input.filePath,
    ) ?? new Map(),
  );
}

export function getImportedExpressionBindingsForFile(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
}): Map<string, ts.Expression> {
  return new Map(
    getSymbolResolutionInternals(input.symbolResolution).importedExpressionBindingsByFilePath.get(
      input.filePath,
    ) ?? new Map(),
  );
}
