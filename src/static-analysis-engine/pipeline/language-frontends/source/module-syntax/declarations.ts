import ts from "typescript";

import type { SourceDeclarationSyntaxIndex } from "./types.js";
import { hasConstModifier } from "./shared.js";

export function collectDeclarations(sourceFile: ts.SourceFile): SourceDeclarationSyntaxIndex {
  const declarations = createEmptyDeclarationIndex();

  for (const statement of sourceFile.statements) {
    collectDeclaration(statement, declarations);
  }

  return declarations;
}

function createEmptyDeclarationIndex(): SourceDeclarationSyntaxIndex {
  return {
    typeAliases: new Map(),
    interfaces: new Map(),
    valueDeclarations: new Map(),
    exportedLocalNames: new Map(),
    reExports: [],
  };
}

function collectDeclaration(
  statement: ts.Statement,
  declarations: SourceDeclarationSyntaxIndex,
): void {
  if (ts.isTypeAliasDeclaration(statement)) {
    declarations.typeAliases.set(statement.name.text, statement);
    return;
  }

  if (ts.isInterfaceDeclaration(statement)) {
    declarations.interfaces.set(statement.name.text, statement);
    return;
  }

  if (ts.isFunctionDeclaration(statement) && statement.name) {
    declarations.valueDeclarations.set(statement.name.text, {
      kind: "function",
      name: statement.name.text,
      node: statement,
    });
    return;
  }

  if (ts.isClassDeclaration(statement) && statement.name) {
    declarations.valueDeclarations.set(statement.name.text, {
      kind: "class",
      name: statement.name.text,
      node: statement,
    });
    return;
  }

  if (ts.isEnumDeclaration(statement)) {
    declarations.valueDeclarations.set(statement.name.text, {
      kind: hasConstModifier(statement) ? "const-enum" : "enum",
      name: statement.name.text,
      node: statement,
    });
    return;
  }

  if (ts.isModuleDeclaration(statement) && ts.isIdentifier(statement.name)) {
    declarations.valueDeclarations.set(statement.name.text, {
      kind: "namespace",
      name: statement.name.text,
      node: statement,
    });
    return;
  }

  if (!ts.isVariableStatement(statement)) {
    return;
  }

  const declarationKind = getVariableStatementKind(statement);
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) {
      continue;
    }
    declarations.valueDeclarations.set(declaration.name.text, {
      kind: declarationKind,
      name: declaration.name.text,
      node: declaration,
      initializer: declaration.initializer,
    });
  }
}

function getVariableStatementKind(statement: ts.VariableStatement): "const" | "let" | "var" {
  if ((statement.declarationList.flags & ts.NodeFlags.Const) !== 0) {
    return "const";
  }
  if ((statement.declarationList.flags & ts.NodeFlags.Let) !== 0) {
    return "let";
  }
  return "var";
}
