import ts from "typescript";

import type {
  ProjectResolutionExportRecord,
  ProjectResolutionFileDeclarationIndex,
} from "./types.js";

export function collectExports(
  filePath: string,
  sourceFile: ts.SourceFile,
): ProjectResolutionExportRecord[] {
  const exports: ProjectResolutionExportRecord[] = [];

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
  declarations: ProjectResolutionFileDeclarationIndex,
  exports: ProjectResolutionExportRecord[],
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
): ProjectResolutionExportRecord[] {
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
): ProjectResolutionExportRecord[] {
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
}): ProjectResolutionExportRecord {
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

function hasExportModifier(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts
      .getModifiers(statement)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
      false)
  );
}

function hasDefaultModifier(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts
      .getModifiers(statement)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ??
      false)
  );
}

function compareExportRecords(
  left: ProjectResolutionExportRecord,
  right: ProjectResolutionExportRecord,
): number {
  return (
    left.exportedName.localeCompare(right.exportedName) ||
    (left.sourceExportedName ?? "").localeCompare(right.sourceExportedName ?? "") ||
    (left.specifier ?? "").localeCompare(right.specifier ?? "")
  );
}
