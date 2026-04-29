import ts from "typescript";

import type {
  SourceImportSyntaxKind,
  SourceImportSyntaxName,
  SourceImportSyntaxRecord,
} from "./types.js";
import { compareImportNames } from "./shared.js";

export function collectImports(
  filePath: string,
  sourceFile: ts.SourceFile,
): SourceImportSyntaxRecord[] {
  const imports: SourceImportSyntaxRecord[] = [];

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

function collectImportNames(statement: ts.ImportDeclaration): SourceImportSyntaxName[] {
  const importClause = statement.importClause;
  if (!importClause) {
    return [];
  }

  const importNames: SourceImportSyntaxName[] = [];
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
  importNames: SourceImportSyntaxName[],
): SourceImportSyntaxKind {
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
  left: SourceImportSyntaxRecord,
  right: SourceImportSyntaxRecord,
): number {
  return (
    left.specifier.localeCompare(right.specifier) ||
    compareImportNames(left.importNames[0], right.importNames[0])
  );
}
