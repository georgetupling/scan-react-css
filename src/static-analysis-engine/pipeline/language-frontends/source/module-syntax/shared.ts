import ts from "typescript";

import type { SourceExportSyntaxRecord, SourceImportSyntaxName } from "./types.js";

export function hasExportModifier(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts
      .getModifiers(statement)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
      false)
  );
}

export function hasDefaultModifier(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts
      .getModifiers(statement)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ??
      false)
  );
}

export function hasConstModifier(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ConstKeyword) ??
      false)
  );
}

export function compareImportNames(
  left: SourceImportSyntaxName | undefined,
  right: SourceImportSyntaxName | undefined,
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

export function compareExportRecords(
  left: SourceExportSyntaxRecord,
  right: SourceExportSyntaxRecord,
): number {
  return (
    left.exportedName.localeCompare(right.exportedName) ||
    (left.sourceExportedName ?? "").localeCompare(right.sourceExportedName ?? "") ||
    (left.specifier ?? "").localeCompare(right.specifier ?? "")
  );
}
