import ts from "typescript";
import type { EngineModuleId } from "../../types/core.js";
import type {
  ModuleExportRecord,
  ModuleGraph,
  ModuleImportKind,
  ModuleImportRecord,
  ModuleNode,
} from "./types.js";

export function buildModuleGraphFromSource(input: {
  filePath: string;
  parsedSourceFile: ts.SourceFile;
  topLevelSymbolIds: string[];
}): ModuleGraph {
  const moduleId = createModuleId(input.filePath);
  const imports: ModuleImportRecord[] = [];
  const exports: ModuleExportRecord[] = [];

  for (const statement of input.parsedSourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push(buildImportRecord(statement));
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      exports.push(...buildExportRecords(statement));
      continue;
    }
  }

  const moduleNode: ModuleNode = {
    id: moduleId,
    filePath: input.filePath,
    kind: "source",
    imports,
    exports,
    topLevelSymbols: input.topLevelSymbolIds,
  };

  return {
    modulesById: new Map([[moduleId, moduleNode]]),
    importEdges: imports
      .filter((entry) => entry.resolvedModuleId)
      .map((entry) => ({
        fromModuleId: moduleId,
        toModuleId: entry.resolvedModuleId as EngineModuleId,
        kind: entry.importKind,
      })),
    exportEdges: exports
      .filter((entry) => entry.reexportedModuleId)
      .map((entry) => ({
        fromModuleId: moduleId,
        toModuleId: entry.reexportedModuleId as EngineModuleId,
        exportedName: entry.exportedName,
      })),
  };
}

export function createModuleId(filePath: string): EngineModuleId {
  return `module:${filePath}`;
}

function buildImportRecord(statement: ts.ImportDeclaration): ModuleImportRecord {
  const specifier = statement.moduleSpecifier.text;
  const importClause = statement.importClause;
  const importedNames: ModuleImportRecord["importedNames"] = [];

  if (importClause?.name) {
    importedNames.push({
      importedName: "default",
      localName: importClause.name.text,
    });
  }

  if (importClause?.namedBindings) {
    if (ts.isNamedImports(importClause.namedBindings)) {
      for (const element of importClause.namedBindings.elements) {
        importedNames.push({
          importedName: element.propertyName?.text ?? element.name.text,
          localName: element.name.text,
        });
      }
    } else {
      importedNames.push({
        importedName: "*",
        localName: importClause.namedBindings.name.text,
      });
    }
  }

  return {
    specifier,
    resolvedModuleId: specifier.startsWith(".") ? createModuleId(specifier) : undefined,
    importKind: classifyImportKind(specifier, importClause?.isTypeOnly === true),
    importedNames,
  };
}

function buildExportRecords(statement: ts.ExportDeclaration): ModuleExportRecord[] {
  if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
    return statement.exportClause.elements.map((element) => ({
      exportedName: element.name.text,
      reexportedModuleId:
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? createModuleId(statement.moduleSpecifier.text)
          : undefined,
    }));
  }

  if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
    return [
      {
        exportedName: "*",
        reexportedModuleId: createModuleId(statement.moduleSpecifier.text),
      },
    ];
  }

  return [];
}

function classifyImportKind(specifier: string, isTypeOnly: boolean): ModuleImportKind {
  if (isTypeOnly) {
    return "type-only";
  }

  if (specifier.endsWith(".css")) {
    return specifier.startsWith(".") ? "css" : "external-css";
  }

  return "source";
}
