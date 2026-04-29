import ts from "typescript";

import type { SourceDeclarationSyntaxIndex, SourceExportSyntaxRecord } from "./types.js";
import { compareExportRecords, hasDefaultModifier, hasExportModifier } from "./shared.js";

export function collectExports(
  filePath: string,
  sourceFile: ts.SourceFile,
): SourceExportSyntaxRecord[] {
  const exports: SourceExportSyntaxRecord[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      exports.push(...collectExportDeclaration(filePath, statement));
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      exports.push({
        filePath,
        exportedName: "default",
        localName: ts.isIdentifier(statement.expression) ? statement.expression.text : undefined,
        typeOnly: false,
        declarationKind: "value",
      });
      continue;
    }

    if (!hasExportModifier(statement)) {
      continue;
    }

    exports.push(...collectDeclarationExports(filePath, statement));
  }

  return exports.sort(compareExportRecords);
}

export function applyExportEvidenceToDeclarations(
  declarations: SourceDeclarationSyntaxIndex,
  exports: SourceExportSyntaxRecord[],
): void {
  for (const exportRecord of exports) {
    if (exportRecord.localName) {
      declarations.exportedLocalNames.set(exportRecord.exportedName, exportRecord.localName);
    }
    if (exportRecord.reexportKind) {
      declarations.reExports.push(exportRecord);
    }
  }
}

function collectDeclarationExports(
  filePath: string,
  statement: ts.Statement,
): SourceExportSyntaxRecord[] {
  if (ts.isFunctionDeclaration(statement) && statement.name) {
    return [
      createLocalExportRecord({
        filePath,
        exportedName: getExportedDeclarationName(statement),
        localName: statement.name.text,
        declarationKind: "value",
      }),
    ];
  }

  if (ts.isFunctionDeclaration(statement) && hasDefaultModifier(statement)) {
    return [
      {
        filePath,
        exportedName: "default",
        typeOnly: false,
        declarationKind: "value",
      },
    ];
  }

  if (ts.isClassDeclaration(statement) && statement.name) {
    return [
      createLocalExportRecord({
        filePath,
        exportedName: getExportedDeclarationName(statement),
        localName: statement.name.text,
        declarationKind: "value",
      }),
    ];
  }

  if (ts.isClassDeclaration(statement) && hasDefaultModifier(statement)) {
    return [
      {
        filePath,
        exportedName: "default",
        typeOnly: false,
        declarationKind: "value",
      },
    ];
  }

  if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
    return [
      createLocalExportRecord({
        filePath,
        exportedName: statement.name.text,
        localName: statement.name.text,
        declarationKind: "type",
      }),
    ];
  }

  if (ts.isEnumDeclaration(statement)) {
    return [
      createLocalExportRecord({
        filePath,
        exportedName: statement.name.text,
        localName: statement.name.text,
        declarationKind: "value",
      }),
    ];
  }

  if (ts.isModuleDeclaration(statement) && ts.isIdentifier(statement.name)) {
    return [
      createLocalExportRecord({
        filePath,
        exportedName: statement.name.text,
        localName: statement.name.text,
        declarationKind: "value",
      }),
    ];
  }

  if (!ts.isVariableStatement(statement)) {
    return [];
  }

  return statement.declarationList.declarations
    .filter((declaration): declaration is ts.VariableDeclaration & { name: ts.Identifier } =>
      ts.isIdentifier(declaration.name),
    )
    .map((declaration) =>
      createLocalExportRecord({
        filePath,
        exportedName: declaration.name.text,
        localName: declaration.name.text,
        declarationKind: "value",
      }),
    );
}

function collectExportDeclaration(
  filePath: string,
  statement: ts.ExportDeclaration,
): SourceExportSyntaxRecord[] {
  const specifier =
    statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
      ? statement.moduleSpecifier.text
      : undefined;
  const exportClause = statement.exportClause;

  if (!exportClause) {
    return [
      {
        filePath,
        exportedName: "*",
        specifier,
        reexportKind: "star",
        typeOnly: statement.isTypeOnly,
        declarationKind: "unknown",
      },
    ];
  }

  if (ts.isNamespaceExport(exportClause)) {
    return [
      {
        filePath,
        exportedName: exportClause.name.text,
        specifier,
        reexportKind: "namespace",
        typeOnly: statement.isTypeOnly,
        declarationKind: "unknown",
      },
    ];
  }

  return exportClause.elements
    .map((element) => {
      const localName = element.propertyName?.text ?? element.name.text;
      return {
        filePath,
        exportedName: element.name.text,
        sourceExportedName: localName,
        localName: specifier ? undefined : localName,
        specifier,
        reexportKind: specifier ? ("named" as const) : undefined,
        typeOnly: statement.isTypeOnly || element.isTypeOnly,
        declarationKind:
          statement.isTypeOnly || element.isTypeOnly ? ("type" as const) : ("unknown" as const),
      };
    })
    .sort(compareExportRecords);
}

function createLocalExportRecord(input: {
  filePath: string;
  exportedName: string;
  localName: string;
  declarationKind: "type" | "value";
}): SourceExportSyntaxRecord {
  return {
    filePath: input.filePath,
    exportedName: input.exportedName,
    sourceExportedName: input.localName,
    localName: input.localName,
    typeOnly: input.declarationKind === "type",
    declarationKind: input.declarationKind,
  };
}

function getExportedDeclarationName(statement: ts.Statement): string {
  if (hasDefaultModifier(statement)) {
    return "default";
  }

  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
    return statement.name.text;
  }

  return "default";
}
