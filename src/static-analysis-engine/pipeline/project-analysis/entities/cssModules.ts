import type {
  CssModuleAliasAnalysis,
  CssModuleDestructuredBindingAnalysis,
  CssModuleImportAnalysis,
  CssModuleMemberMatchRelation,
  CssModuleMemberReferenceAnalysis,
  CssModuleReferenceDiagnosticAnalysis,
  ProjectAnalysisBuildInput,
  ProjectAnalysisIndexes,
} from "../types.js";
import {
  compareById,
  createCssModuleAliasId,
  createCssModuleDestructuredBindingId,
  createCssModuleDiagnosticId,
  createCssModuleImportId,
  createCssModuleImportLookupKey,
  createCssModuleMemberReferenceId,
  mergeTraces,
  normalizeAnchor,
  normalizeProjectPath,
  uniqueSorted,
} from "../internal/shared.js";

export function buildCssModuleImports(
  input: ProjectAnalysisBuildInput,
  indexes: ProjectAnalysisIndexes,
): CssModuleImportAnalysis[] {
  return input.cssModules.imports
    .map((cssModuleImport) => {
      const sourceFilePath = normalizeProjectPath(cssModuleImport.sourceFilePath);
      const stylesheetFilePath = normalizeProjectPath(cssModuleImport.stylesheetFilePath);
      const sourceFileId = indexes.sourceFileIdByPath.get(sourceFilePath);
      const stylesheetId = indexes.stylesheetIdByPath.get(stylesheetFilePath);

      if (!sourceFileId || !stylesheetId) {
        return undefined;
      }

      return {
        id: createCssModuleImportId({
          sourceFilePath,
          stylesheetFilePath,
          localName: cssModuleImport.localName,
        }),
        sourceFileId,
        stylesheetId,
        sourceFilePath,
        stylesheetFilePath,
        specifier: cssModuleImport.specifier,
        localName: cssModuleImport.localName,
        importKind: cssModuleImport.importKind,
      };
    })
    .filter((cssModuleImport): cssModuleImport is CssModuleImportAnalysis =>
      Boolean(cssModuleImport),
    )
    .sort(compareById);
}

export function buildCssModuleMemberReferences(input: {
  projectInput: ProjectAnalysisBuildInput;
  imports: CssModuleImportAnalysis[];
  indexes: ProjectAnalysisIndexes;
  includeTraces: boolean;
}): {
  aliases: CssModuleAliasAnalysis[];
  destructuredBindings: CssModuleDestructuredBindingAnalysis[];
  memberReferences: CssModuleMemberReferenceAnalysis[];
  diagnostics: CssModuleReferenceDiagnosticAnalysis[];
} {
  const importsBySourceStylesheetAndLocalName = new Map<string, CssModuleImportAnalysis>();
  for (const cssModuleImport of input.imports) {
    importsBySourceStylesheetAndLocalName.set(
      createCssModuleImportLookupKey({
        sourceFilePath: cssModuleImport.sourceFilePath,
        stylesheetFilePath: cssModuleImport.stylesheetFilePath,
        localName: cssModuleImport.localName,
      }),
      cssModuleImport,
    );
  }

  return {
    aliases: input.projectInput.cssModules.aliases
      .map((alias) => {
        const cssModuleImport = importsBySourceStylesheetAndLocalName.get(
          createCssModuleImportLookupKey(alias),
        );
        if (!cssModuleImport) {
          return undefined;
        }

        return {
          id: createCssModuleAliasId(alias.location, cssModuleImport.id, alias.aliasName),
          importId: cssModuleImport.id,
          sourceFileId: cssModuleImport.sourceFileId,
          stylesheetId: cssModuleImport.stylesheetId,
          localName: alias.localName,
          aliasName: alias.aliasName,
          location: normalizeAnchor(alias.location),
          rawExpressionText: alias.rawExpressionText,
          traces: input.includeTraces ? [...alias.traces] : [],
        };
      })
      .filter((alias): alias is CssModuleAliasAnalysis => Boolean(alias))
      .sort(compareById),
    destructuredBindings: input.projectInput.cssModules.destructuredBindings
      .map((binding) => {
        const cssModuleImport = importsBySourceStylesheetAndLocalName.get(
          createCssModuleImportLookupKey(binding),
        );
        if (!cssModuleImport) {
          return undefined;
        }

        return {
          id: createCssModuleDestructuredBindingId(
            binding.location,
            cssModuleImport.id,
            binding.memberName,
            binding.bindingName,
          ),
          importId: cssModuleImport.id,
          sourceFileId: cssModuleImport.sourceFileId,
          stylesheetId: cssModuleImport.stylesheetId,
          localName: binding.localName,
          memberName: binding.memberName,
          bindingName: binding.bindingName,
          location: normalizeAnchor(binding.location),
          rawExpressionText: binding.rawExpressionText,
          traces: input.includeTraces ? [...binding.traces] : [],
        };
      })
      .filter((binding): binding is CssModuleDestructuredBindingAnalysis => Boolean(binding))
      .sort(compareById),
    memberReferences: input.projectInput.cssModules.memberReferences
      .map((reference) => {
        const cssModuleImport = importsBySourceStylesheetAndLocalName.get(
          createCssModuleImportLookupKey(reference),
        );
        if (!cssModuleImport) {
          return undefined;
        }

        return {
          id: createCssModuleMemberReferenceId(
            reference.location,
            cssModuleImport.id,
            reference.memberName,
          ),
          importId: cssModuleImport.id,
          sourceFileId: cssModuleImport.sourceFileId,
          stylesheetId: cssModuleImport.stylesheetId,
          localName: reference.localName,
          memberName: reference.memberName,
          accessKind: reference.accessKind,
          location: normalizeAnchor(reference.location),
          rawExpressionText: reference.rawExpressionText,
          traces: input.includeTraces ? [...reference.traces] : [],
        };
      })
      .filter((reference): reference is CssModuleMemberReferenceAnalysis => Boolean(reference))
      .sort(compareById),
    diagnostics: input.projectInput.cssModules.diagnostics
      .map((diagnostic) => {
        const cssModuleImport = importsBySourceStylesheetAndLocalName.get(
          createCssModuleImportLookupKey(diagnostic),
        );
        if (!cssModuleImport) {
          return undefined;
        }

        return {
          id: createCssModuleDiagnosticId(diagnostic.location, cssModuleImport.id),
          importId: cssModuleImport.id,
          sourceFileId: cssModuleImport.sourceFileId,
          stylesheetId: cssModuleImport.stylesheetId,
          localName: diagnostic.localName,
          reason: diagnostic.reason,
          location: normalizeAnchor(diagnostic.location),
          rawExpressionText: diagnostic.rawExpressionText,
          traces: input.includeTraces ? [...diagnostic.traces] : [],
        };
      })
      .filter((diagnostic): diagnostic is CssModuleReferenceDiagnosticAnalysis =>
        Boolean(diagnostic),
      )
      .sort(compareById),
  };
}

export function buildCssModuleMemberMatches(input: {
  references: CssModuleMemberReferenceAnalysis[];
  indexes: ProjectAnalysisIndexes;
  localsConvention: ProjectAnalysisBuildInput["cssModules"]["options"]["localsConvention"];
  includeTraces: boolean;
}): CssModuleMemberMatchRelation[] {
  const matches: CssModuleMemberMatchRelation[] = [];

  for (const reference of input.references) {
    const definitionIds = input.indexes.definitionsByStylesheetId.get(reference.stylesheetId) ?? [];
    const definitionId = definitionIds.find((candidateId) => {
      const definition = input.indexes.classDefinitionsById.get(candidateId);
      return (
        definition &&
        getCssModuleExportNames(definition.className, input.localsConvention).includes(
          reference.memberName,
        )
      );
    });

    if (definitionId) {
      const definition = input.indexes.classDefinitionsById.get(definitionId);
      const originalClassName = definition?.className ?? reference.memberName;
      matches.push({
        id: `css-module-member-match:${reference.id}:${definitionId}`,
        referenceId: reference.id,
        importId: reference.importId,
        stylesheetId: reference.stylesheetId,
        definitionId,
        className: originalClassName,
        exportName: reference.memberName,
        status: "matched",
        reasons: [
          `CSS Module member "${reference.memberName}" matched exported class "${originalClassName}"`,
        ],
        traces: input.includeTraces ? mergeTraces(reference.traces) : [],
      });
      continue;
    }

    matches.push({
      id: `css-module-member-match:${reference.id}:missing`,
      referenceId: reference.id,
      importId: reference.importId,
      stylesheetId: reference.stylesheetId,
      className: reference.memberName,
      exportName: reference.memberName,
      status: "missing",
      reasons: [`CSS Module member "${reference.memberName}" has no exported class`],
      traces: input.includeTraces ? mergeTraces(reference.traces) : [],
    });
  }

  return matches.sort(compareById);
}

export function getCssModuleExportNames(
  className: string,
  localsConvention: ProjectAnalysisBuildInput["cssModules"]["options"]["localsConvention"],
): string[] {
  const exportNames =
    localsConvention === "asIs"
      ? [className]
      : localsConvention === "camelCaseOnly"
        ? [toCamelCaseClassName(className)]
        : [className, toCamelCaseClassName(className)];

  return uniqueSorted(exportNames);
}

export function toCamelCaseClassName(className: string): string {
  return className.replace(/[-_]+([a-zA-Z0-9])/g, (_match, character: string) =>
    character.toUpperCase(),
  );
}
