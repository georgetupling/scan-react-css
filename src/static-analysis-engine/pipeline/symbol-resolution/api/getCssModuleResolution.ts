import type {
  ProjectBindingResolution,
  ResolvedCssModuleBindingDiagnostic,
  ResolvedCssModuleImport,
  ResolvedCssModuleMemberAccessResult,
  ResolvedCssModuleMemberBinding,
  ResolvedCssModuleMemberReference,
  ResolvedCssModuleNamespaceBinding,
} from "../types.js";
import { getSymbolResolutionInternals } from "../internals.js";

export type ResolvedCssModuleBindingsForFile = {
  imports: ResolvedCssModuleImport[];
  namespaceBindings: ResolvedCssModuleNamespaceBinding[];
  memberBindings: ResolvedCssModuleMemberBinding[];
  memberReferences: ResolvedCssModuleMemberReference[];
  diagnostics: ResolvedCssModuleBindingDiagnostic[];
};

export function resolveCssModuleNamespace(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  localName: string;
}): ResolvedCssModuleNamespaceBinding | undefined {
  return getSymbolResolutionInternals(input.symbolResolution)
    .resolvedCssModuleNamespaceBindingsByFilePath.get(input.filePath)
    ?.get(input.localName);
}

export function resolveCssModuleMember(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  localName: string;
}): ResolvedCssModuleMemberBinding | undefined {
  return getSymbolResolutionInternals(input.symbolResolution)
    .resolvedCssModuleMemberBindingsByFilePath.get(input.filePath)
    ?.get(input.localName);
}

export function resolveCssModuleMemberAccess(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  localName: string;
  memberName: string;
}): ResolvedCssModuleMemberAccessResult | undefined {
  const internals = getSymbolResolutionInternals(input.symbolResolution);
  const resolvedReference = (
    internals.resolvedCssModuleMemberReferencesByFilePath.get(input.filePath) ?? []
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
    internals.resolvedCssModuleBindingDiagnosticsByFilePath.get(input.filePath) ?? []
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

export function getCssModuleBindingsForFile(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
}): ResolvedCssModuleBindingsForFile {
  const internals = getSymbolResolutionInternals(input.symbolResolution);
  return {
    imports: [...(internals.resolvedCssModuleImportsByFilePath.get(input.filePath) ?? [])],
    namespaceBindings: [
      ...(internals.resolvedCssModuleNamespaceBindingsByFilePath.get(input.filePath)?.values() ??
        []),
    ],
    memberBindings: [
      ...(internals.resolvedCssModuleMemberBindingsByFilePath.get(input.filePath)?.values() ?? []),
    ],
    memberReferences: [
      ...(internals.resolvedCssModuleMemberReferencesByFilePath.get(input.filePath) ?? []),
    ],
    diagnostics: [
      ...(internals.resolvedCssModuleBindingDiagnosticsByFilePath.get(input.filePath) ?? []),
    ],
  };
}
