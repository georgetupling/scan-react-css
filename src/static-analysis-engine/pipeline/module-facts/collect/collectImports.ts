import ts from "typescript";

import type {
  ModuleFactsImportKind,
  ModuleFactsImportName,
  ModuleFactsImportRecord,
} from "../types.js";

export function collectImports(
  filePath: string,
  sourceFile: ts.SourceFile,
): ModuleFactsImportRecord[] {
  const imports: ModuleFactsImportRecord[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const specifier = statement.moduleSpecifier.text;
    const importNames = collectImportNames(statement);
    imports.push({
      filePath,
      specifier,
      importKind: classifyImportKind(specifier, importNames),
      importNames,
    });
  }

  return imports.sort(compareImportRecords);
}

function collectImportNames(statement: ts.ImportDeclaration): ModuleFactsImportName[] {
  const importClause = statement.importClause;
  if (!importClause) {
    return [];
  }

  const importNames: ModuleFactsImportName[] = [];
  if (importClause.name) {
    importNames.push({
      kind: "default",
      importedName: "default",
      localName: importClause.name.text,
      typeOnly: importClause.isTypeOnly,
    });
  }

  const namedBindings = importClause.namedBindings;
  if (!namedBindings) {
    return importNames;
  }

  if (ts.isNamespaceImport(namedBindings)) {
    importNames.push({
      kind: "namespace",
      importedName: "*",
      localName: namedBindings.name.text,
      typeOnly: importClause.isTypeOnly,
    });
    return importNames;
  }

  for (const element of namedBindings.elements) {
    const importedName = element.propertyName?.text ?? element.name.text;
    importNames.push({
      kind: "named",
      importedName,
      localName: element.name.text,
      typeOnly: importClause.isTypeOnly || element.isTypeOnly,
    });
  }

  return importNames.sort(compareImportNames);
}

function classifyImportKind(
  specifier: string,
  importNames: ModuleFactsImportName[],
): ModuleFactsImportKind {
  if (importNames.length > 0 && importNames.every((importName) => importName.typeOnly)) {
    return "type-only";
  }

  if (specifier.endsWith(".css")) {
    return "css";
  }

  if (specifier.startsWith("http://") || specifier.startsWith("https://")) {
    return "external-css";
  }

  if (specifier.startsWith(".") || specifier.startsWith("/") || /^[^./@][^:]*$/.test(specifier)) {
    return "source";
  }

  if (specifier.startsWith("@")) {
    return "source";
  }

  return "unknown";
}

function compareImportRecords(
  left: ModuleFactsImportRecord,
  right: ModuleFactsImportRecord,
): number {
  return (
    left.specifier.localeCompare(right.specifier) ||
    compareImportNames(left.importNames[0], right.importNames[0])
  );
}

function compareImportNames(
  left: ModuleFactsImportName | undefined,
  right: ModuleFactsImportName | undefined,
): number {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }
  return (
    left.kind.localeCompare(right.kind) ||
    left.importedName.localeCompare(right.importedName) ||
    left.localName.localeCompare(right.localName)
  );
}
