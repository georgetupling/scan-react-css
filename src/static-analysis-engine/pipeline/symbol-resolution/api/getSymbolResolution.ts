import ts from "typescript";

import type { EngineSymbolId } from "../../../types/core.js";
import { collectSourceDeclarationIndex } from "../collection/collectSourceDeclarations.js";
import type {
  EngineSymbol,
  ProjectBindingResolution,
  ResolvedCssModuleMemberAccessResult,
  ResolvedCssModuleMemberBinding,
  ResolvedCssModuleNamespaceBinding,
  ResolvedTypeBinding,
  SymbolSpace,
} from "../types.js";

export type ResolvedTypeDeclaration =
  | {
      kind: "type-alias";
      declaration: ts.TypeAliasDeclaration;
      binding: ResolvedTypeBinding;
    }
  | {
      kind: "interface";
      declaration: ts.InterfaceDeclaration;
      binding: ResolvedTypeBinding;
    };

export function getSymbol(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  localName: string;
  symbolSpace: SymbolSpace;
}): EngineSymbol | undefined {
  return findSymbolByLocalNameAndSpace({
    symbolsByFilePath: input.symbolResolution.symbolsByFilePath,
    filePath: input.filePath,
    localName: input.localName,
    symbolSpace: input.symbolSpace,
  });
}

export function resolveTypeBinding(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  localName: string;
}): ResolvedTypeBinding | undefined {
  const resolvedImportedTypeBinding = input.symbolResolution.resolvedTypeBindingsByFilePath
    .get(input.filePath)
    ?.get(input.localName);
  if (resolvedImportedTypeBinding) {
    return resolvedImportedTypeBinding;
  }

  const localTypeSymbol = findTypeSymbolByLocalName({
    symbolsByFilePath: input.symbolResolution.symbolsByFilePath,
    filePath: input.filePath,
    localName: input.localName,
  });
  if (!localTypeSymbol) {
    return undefined;
  }

  return {
    localName: input.localName,
    targetModuleId: localTypeSymbol.moduleId,
    targetFilePath: input.filePath,
    targetTypeName: localTypeSymbol.localName,
    targetSymbolId: localTypeSymbol.id,
    traces: [],
  };
}

export function resolveCssModuleNamespace(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  localName: string;
}): ResolvedCssModuleNamespaceBinding | undefined {
  return input.symbolResolution.resolvedCssModuleNamespaceBindingsByFilePath
    .get(input.filePath)
    ?.get(input.localName);
}

export function resolveCssModuleMember(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  localName: string;
}): ResolvedCssModuleMemberBinding | undefined {
  return input.symbolResolution.resolvedCssModuleMemberBindingsByFilePath
    .get(input.filePath)
    ?.get(input.localName);
}

export function resolveCssModuleMemberAccess(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  localName: string;
  memberName: string;
}): ResolvedCssModuleMemberAccessResult | undefined {
  const resolvedReference = (
    input.symbolResolution.resolvedCssModuleMemberReferencesByFilePath.get(input.filePath) ?? []
  ).find(
    (reference) =>
      reference.localName === input.localName &&
      reference.memberName === input.memberName &&
      reference.accessKind !== "destructured-binding",
  );
  if (resolvedReference) {
    return {
      kind: "resolved",
      reference: resolvedReference,
    };
  }

  const namespaceBinding = resolveCssModuleNamespace({
    symbolResolution: input.symbolResolution,
    filePath: input.filePath,
    localName: input.localName,
  });
  if (!namespaceBinding) {
    return undefined;
  }

  const unresolvedDiagnostic = (
    input.symbolResolution.resolvedCssModuleBindingDiagnosticsByFilePath.get(input.filePath) ?? []
  ).find(
    (diagnostic) =>
      diagnostic.localName === input.localName &&
      diagnostic.reason === "computed-css-module-member",
  );
  if (unresolvedDiagnostic) {
    return {
      kind: "unresolved",
      reason: unresolvedDiagnostic.reason,
      traces: unresolvedDiagnostic.traces,
    };
  }

  return {
    kind: "resolved",
    reference: {
      sourceFilePath: namespaceBinding.sourceFilePath,
      stylesheetFilePath: namespaceBinding.stylesheetFilePath,
      specifier: namespaceBinding.specifier,
      localName: namespaceBinding.localName,
      originLocalName: namespaceBinding.originLocalName,
      memberName: input.memberName,
      accessKind: "property",
      location: namespaceBinding.location,
      rawExpressionText: `${input.localName}.${input.memberName}`,
      traces: namespaceBinding.traces,
    },
  };
}

export function resolveExportedTypeBinding(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  exportedName: string;
}): ResolvedTypeBinding | undefined {
  return input.symbolResolution.resolvedExportedTypeBindingsByFilePath
    .get(input.filePath)
    ?.get(input.exportedName);
}

export function resolveTypeDeclaration(input: {
  symbolResolution: ProjectBindingResolution;
  sourceFilesByFilePath: Map<string, ts.SourceFile>;
  filePath: string;
  localName: string;
}): ResolvedTypeDeclaration | undefined {
  const resolvedBinding = resolveTypeBinding({
    symbolResolution: input.symbolResolution,
    filePath: input.filePath,
    localName: input.localName,
  });
  if (!resolvedBinding) {
    return undefined;
  }

  return resolveBoundTypeDeclaration({
    sourceFilesByFilePath: input.sourceFilesByFilePath,
    binding: resolvedBinding,
  });
}

export function resolveExportedTypeDeclaration(input: {
  symbolResolution: ProjectBindingResolution;
  sourceFilesByFilePath: Map<string, ts.SourceFile>;
  filePath: string;
  exportedName: string;
}): ResolvedTypeDeclaration | undefined {
  const resolvedBinding = resolveExportedTypeBinding({
    symbolResolution: input.symbolResolution,
    filePath: input.filePath,
    exportedName: input.exportedName,
  });
  if (!resolvedBinding) {
    return undefined;
  }

  return resolveBoundTypeDeclaration({
    sourceFilesByFilePath: input.sourceFilesByFilePath,
    binding: resolvedBinding,
  });
}

function findTypeSymbolByLocalName(input: {
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  filePath: string;
  localName: string;
}): EngineSymbol | undefined {
  return findSymbolByLocalNameAndSpace({
    symbolsByFilePath: input.symbolsByFilePath,
    filePath: input.filePath,
    localName: input.localName,
    symbolSpace: "type",
  });
}

function findSymbolByLocalNameAndSpace(input: {
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  filePath: string;
  localName: string;
  symbolSpace: SymbolSpace;
}): EngineSymbol | undefined {
  for (const symbol of input.symbolsByFilePath.get(input.filePath)?.values() ?? []) {
    if (symbol.localName !== input.localName) {
      continue;
    }

    if (input.symbolSpace === "type" ? isTypeSymbol(symbol) : !isTypeSymbol(symbol)) {
      return symbol;
    }
  }

  return undefined;
}

function isTypeSymbol(symbol: EngineSymbol): boolean {
  return symbol.kind === "type-alias" || symbol.kind === "interface";
}

function resolveBoundTypeDeclaration(input: {
  sourceFilesByFilePath: Map<string, ts.SourceFile>;
  binding: ResolvedTypeBinding;
}): ResolvedTypeDeclaration | undefined {
  const sourceFile = input.sourceFilesByFilePath.get(input.binding.targetFilePath);
  if (!sourceFile) {
    return undefined;
  }

  const declarationIndex = collectSourceDeclarationIndex(sourceFile);
  const typeAliasDeclaration = declarationIndex.typeAliases.get(input.binding.targetTypeName);
  if (typeAliasDeclaration) {
    return {
      kind: "type-alias",
      declaration: typeAliasDeclaration,
      binding: input.binding,
    };
  }

  const interfaceDeclaration = declarationIndex.interfaces.get(input.binding.targetTypeName);
  if (interfaceDeclaration) {
    return {
      kind: "interface",
      declaration: interfaceDeclaration,
      binding: input.binding,
    };
  }

  return undefined;
}
