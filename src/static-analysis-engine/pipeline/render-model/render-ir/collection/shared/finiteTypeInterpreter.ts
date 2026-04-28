import ts from "typescript";
import type { ModuleFacts } from "../../../../module-facts/index.js";
import { normalizeFilePath } from "../../../../module-facts/shared/pathUtils.js";
import {
  resolveTypeDeclaration,
  type ProjectBindingResolution,
} from "../../../../symbol-resolution/index.js";

type LocalTypeEvidence = {
  filePath: string;
  cache?: FiniteTypeInterpreterCache;
  typeAliases: Map<string, ts.TypeNode>;
  interfaces: Map<string, ts.InterfaceDeclaration>;
  constBindings: Map<string, ts.Expression>;
};

type TypeResolutionState = {
  seenTypeNames: Set<string>;
};

type FiniteResolvedTypeDeclaration =
  | { kind: "type-alias"; type: ts.TypeNode; evidence: LocalTypeEvidence }
  | { kind: "interface"; declaration: ts.InterfaceDeclaration; evidence: LocalTypeEvidence };

export type FiniteTypeInterpreterCache = {
  moduleFacts: ModuleFacts;
  symbolResolution: ProjectBindingResolution;
  sourceFilesByFilePath: Map<string, ts.SourceFile>;
  evidenceByFilePath: Map<string, LocalTypeEvidence>;
};

export function createFiniteTypeInterpreterCache(input: {
  moduleFacts: ModuleFacts;
  symbolResolution: ProjectBindingResolution;
  parsedFiles: Array<{
    filePath: string;
    parsedSourceFile: ts.SourceFile;
  }>;
}): FiniteTypeInterpreterCache {
  return {
    moduleFacts: input.moduleFacts,
    symbolResolution: input.symbolResolution,
    sourceFilesByFilePath: new Map(
      input.parsedFiles.map((parsedFile) => [
        normalizeFilePath(parsedFile.filePath),
        parsedFile.parsedSourceFile,
      ]),
    ),
    evidenceByFilePath: new Map(),
  };
}

export function collectFiniteStringValuesByProperty(
  parameter: ts.ParameterDeclaration,
  cache?: FiniteTypeInterpreterCache,
): Map<string, string[]> {
  const valuesByProperty = new Map<string, string[]>();
  if (!parameter.type) {
    return valuesByProperty;
  }

  const evidence = getLocalTypeEvidence(
    normalizeFilePath(parameter.getSourceFile().fileName),
    parameter.getSourceFile(),
    cache,
  );
  const propertyTypes = collectObjectPropertyTypes(parameter.type, evidence, {
    seenTypeNames: new Set(),
  });
  for (const [propertyName, typeNode] of propertyTypes.entries()) {
    const values = resolveFiniteStringType(typeNode, evidence, {
      seenTypeNames: new Set(),
    });
    if (values.length > 0) {
      valuesByProperty.set(propertyName, values);
    }
  }

  return valuesByProperty;
}

function getLocalTypeEvidence(
  filePath: string,
  sourceFile: ts.SourceFile,
  cache: FiniteTypeInterpreterCache | undefined,
): LocalTypeEvidence {
  const normalizedFilePath = normalizeFilePath(filePath);
  const cachedEvidence = cache?.evidenceByFilePath.get(normalizedFilePath);
  if (cachedEvidence) {
    return cachedEvidence;
  }

  const evidence = collectLocalTypeEvidence(normalizedFilePath, sourceFile, cache);
  cache?.evidenceByFilePath.set(normalizedFilePath, evidence);
  return evidence;
}

function collectLocalTypeEvidence(
  filePath: string,
  sourceFile: ts.SourceFile,
  cache: FiniteTypeInterpreterCache | undefined,
): LocalTypeEvidence {
  const typeAliases = new Map<string, ts.TypeNode>();
  const interfaces = new Map<string, ts.InterfaceDeclaration>();
  const constBindings = new Map<string, ts.Expression>();

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      collectConstBindings(statement, constBindings);
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      typeAliases.set(statement.name.text, statement.type);
      continue;
    }

    if (ts.isInterfaceDeclaration(statement)) {
      interfaces.set(statement.name.text, statement);
      continue;
    }
  }

  return {
    filePath,
    cache,
    typeAliases,
    interfaces,
    constBindings,
  };
}

function collectConstBindings(
  statement: ts.VariableStatement,
  constBindings: Map<string, ts.Expression>,
): void {
  if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
    return;
  }

  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
      continue;
    }

    constBindings.set(declaration.name.text, declaration.initializer);
  }
}

function collectObjectPropertyTypes(
  typeNode: ts.TypeNode,
  evidence: LocalTypeEvidence,
  state: TypeResolutionState,
): Map<string, ts.TypeNode> {
  if (ts.isTypeLiteralNode(typeNode)) {
    return collectTypeLiteralPropertyTypes(typeNode);
  }

  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    const merged = new Map<string, ts.TypeNode>();
    for (const entry of typeNode.types) {
      mergePropertyMaps(merged, collectObjectPropertyTypes(entry, evidence, state));
    }

    return merged;
  }

  if (ts.isParenthesizedTypeNode(typeNode)) {
    return collectObjectPropertyTypes(typeNode.type, evidence, state);
  }

  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const utilityType = collectSupportedUtilityObjectPropertyTypes(typeNode, evidence, state);
    if (utilityType) {
      return utilityType;
    }

    return collectNamedObjectPropertyTypes(typeNode.typeName.text, evidence, state);
  }

  return new Map();
}

function collectTypeLiteralPropertyTypes(typeNode: ts.TypeLiteralNode): Map<string, ts.TypeNode> {
  const propertyTypes = new Map<string, ts.TypeNode>();
  for (const member of typeNode.members) {
    if (!ts.isPropertySignature(member) || !member.type) {
      continue;
    }

    const propertyName = getStaticPropertyName(member.name);
    if (propertyName) {
      propertyTypes.set(propertyName, member.type);
    }
  }

  return propertyTypes;
}

function collectNamedObjectPropertyTypes(
  typeName: string,
  evidence: LocalTypeEvidence,
  state: TypeResolutionState,
): Map<string, ts.TypeNode> {
  const typeKey = createTypeKey(evidence.filePath, typeName);
  if (state.seenTypeNames.has(typeKey)) {
    return new Map();
  }

  const nextState = {
    ...state,
    seenTypeNames: new Set([...state.seenTypeNames, typeKey]),
  };
  const aliasedType = evidence.typeAliases.get(typeName);
  if (aliasedType) {
    return collectObjectPropertyTypes(aliasedType, evidence, nextState);
  }

  const interfaceDeclaration = evidence.interfaces.get(typeName);
  if (interfaceDeclaration) {
    return collectInterfacePropertyTypes(interfaceDeclaration, evidence, nextState);
  }

  const importedDeclaration = resolveImportedTypeDeclaration(typeName, evidence, nextState);
  if (!importedDeclaration) {
    return new Map();
  }

  return importedDeclaration.kind === "interface"
    ? collectInterfacePropertyTypes(
        importedDeclaration.declaration,
        importedDeclaration.evidence,
        nextState,
      )
    : collectObjectPropertyTypes(importedDeclaration.type, importedDeclaration.evidence, nextState);
}

function collectInterfacePropertyTypes(
  interfaceDeclaration: ts.InterfaceDeclaration,
  evidence: LocalTypeEvidence,
  state: TypeResolutionState,
): Map<string, ts.TypeNode> {
  const properties = new Map<string, ts.TypeNode>();
  for (const heritageClause of interfaceDeclaration.heritageClauses ?? []) {
    if (heritageClause.token !== ts.SyntaxKind.ExtendsKeyword) {
      continue;
    }

    for (const inheritedType of heritageClause.types) {
      if (ts.isIdentifier(inheritedType.expression)) {
        mergePropertyMaps(
          properties,
          collectNamedObjectPropertyTypes(inheritedType.expression.text, evidence, state),
        );
      }
    }
  }

  mergePropertyMaps(properties, collectInterfaceOwnPropertyTypes(interfaceDeclaration));
  return properties;
}

function collectInterfaceOwnPropertyTypes(
  interfaceDeclaration: ts.InterfaceDeclaration,
): Map<string, ts.TypeNode> {
  const propertyTypes = new Map<string, ts.TypeNode>();
  for (const member of interfaceDeclaration.members) {
    if (!ts.isPropertySignature(member) || !member.type) {
      continue;
    }

    const propertyName = getStaticPropertyName(member.name);
    if (propertyName) {
      propertyTypes.set(propertyName, member.type);
    }
  }

  return propertyTypes;
}

function collectSupportedUtilityObjectPropertyTypes(
  typeNode: ts.TypeReferenceNode,
  evidence: LocalTypeEvidence,
  state: TypeResolutionState,
): Map<string, ts.TypeNode> | undefined {
  if (!ts.isIdentifier(typeNode.typeName)) {
    return undefined;
  }

  const utilityName = typeNode.typeName.text;
  const [sourceType, keysType] = typeNode.typeArguments ?? [];

  if (utilityName === "Partial" || utilityName === "Required" || utilityName === "Readonly") {
    return sourceType ? collectObjectPropertyTypes(sourceType, evidence, state) : new Map();
  }

  if (utilityName === "Pick" || utilityName === "Omit") {
    if (!sourceType || !keysType) {
      return new Map();
    }

    const properties = collectObjectPropertyTypes(sourceType, evidence, state);
    const selectedKeys = new Set(
      resolveFiniteStringType(keysType, evidence, {
        seenTypeNames: new Set(),
      }),
    );
    if (selectedKeys.size === 0 && keysType.kind !== ts.SyntaxKind.NeverKeyword) {
      return new Map();
    }

    if (utilityName === "Pick") {
      return new Map([...properties].filter(([propertyName]) => selectedKeys.has(propertyName)));
    }

    for (const key of selectedKeys) {
      properties.delete(key);
    }

    return properties;
  }

  return undefined;
}

function mergePropertyMaps(
  target: Map<string, ts.TypeNode>,
  source: Map<string, ts.TypeNode>,
): void {
  for (const [propertyName, propertyType] of source.entries()) {
    target.set(propertyName, mergePropertyTypeNodes(target.get(propertyName), propertyType));
  }
}

function mergePropertyTypeNodes(existing: ts.TypeNode | undefined, next: ts.TypeNode): ts.TypeNode {
  if (!existing) {
    return next;
  }

  return ts.factory.createUnionTypeNode([existing, next]);
}

function resolveFiniteStringType(
  typeNode: ts.TypeNode,
  evidence: LocalTypeEvidence,
  state: TypeResolutionState,
): string[] {
  if (ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal)) {
    return [typeNode.literal.text];
  }

  if (ts.isUnionTypeNode(typeNode)) {
    const values = typeNode.types.flatMap((entry) =>
      resolveFiniteStringType(entry, evidence, state),
    );
    return uniqueSorted(values);
  }

  if (ts.isParenthesizedTypeNode(typeNode)) {
    return resolveFiniteStringType(typeNode.type, evidence, state);
  }

  if (ts.isIndexedAccessTypeNode(typeNode)) {
    return resolveIndexedAccessFiniteStringType(typeNode, evidence, state);
  }

  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const utilityValues = resolveSupportedUtilityFiniteStringType(typeNode, evidence, state);
    if (utilityValues) {
      return utilityValues;
    }

    const typeName = typeNode.typeName.text;
    const typeKey = createTypeKey(evidence.filePath, typeName);
    if (state.seenTypeNames.has(typeKey)) {
      return [];
    }

    const nextState = {
      ...state,
      seenTypeNames: new Set([...state.seenTypeNames, typeKey]),
    };
    const aliasedType = evidence.typeAliases.get(typeName);
    if (aliasedType) {
      return resolveFiniteStringType(aliasedType, evidence, nextState);
    }

    const importedDeclaration = resolveImportedTypeDeclaration(typeName, evidence, nextState);
    if (!importedDeclaration || importedDeclaration.kind !== "type-alias") {
      return [];
    }

    return resolveFiniteStringType(
      importedDeclaration.type,
      importedDeclaration.evidence,
      nextState,
    );
  }

  return [];
}

function resolveIndexedAccessFiniteStringType(
  typeNode: ts.IndexedAccessTypeNode,
  evidence: LocalTypeEvidence,
  state: TypeResolutionState,
): string[] {
  const tupleValues = resolveConstTupleIndexedAccess(typeNode, evidence);
  if (tupleValues.length > 0) {
    return tupleValues;
  }

  const propertyNames = resolveFiniteStringType(typeNode.indexType, evidence, {
    seenTypeNames: new Set(),
  });
  if (propertyNames.length === 0) {
    return [];
  }

  const properties = collectObjectPropertyTypes(typeNode.objectType, evidence, state);
  return uniqueSorted(
    propertyNames.flatMap((propertyName) => {
      const propertyType = properties.get(propertyName);
      return propertyType
        ? resolveFiniteStringType(propertyType, evidence, {
            seenTypeNames: new Set(),
          })
        : [];
    }),
  );
}

function resolveConstTupleIndexedAccess(
  typeNode: ts.IndexedAccessTypeNode,
  evidence: LocalTypeEvidence,
): string[] {
  if (typeNode.indexType.kind !== ts.SyntaxKind.NumberKeyword) {
    return [];
  }

  const objectType = unwrapTypeNode(typeNode.objectType);
  if (!ts.isTypeQueryNode(objectType) || !ts.isIdentifier(objectType.exprName)) {
    return [];
  }

  const expression = evidence.constBindings.get(objectType.exprName.text);
  if (!expression) {
    return [];
  }

  return resolveConstTupleStringValues(expression);
}

function resolveConstTupleStringValues(expression: ts.Expression): string[] {
  const unwrappedExpression = unwrapConstExpression(expression);
  if (!ts.isArrayLiteralExpression(unwrappedExpression)) {
    return [];
  }

  const values: string[] = [];
  for (const element of unwrappedExpression.elements) {
    if (ts.isSpreadElement(element)) {
      return [];
    }

    const valueExpression = unwrapConstExpression(element);
    if (
      ts.isStringLiteral(valueExpression) ||
      ts.isNoSubstitutionTemplateLiteral(valueExpression)
    ) {
      values.push(valueExpression.text);
      continue;
    }

    return [];
  }

  return uniqueSorted(values);
}

function resolveSupportedUtilityFiniteStringType(
  typeNode: ts.TypeReferenceNode,
  evidence: LocalTypeEvidence,
  state: TypeResolutionState,
): string[] | undefined {
  if (!ts.isIdentifier(typeNode.typeName)) {
    return undefined;
  }

  const utilityName = typeNode.typeName.text;
  const [sourceType, filterType] = typeNode.typeArguments ?? [];

  if (utilityName === "NonNullable") {
    return sourceType ? resolveFiniteStringType(sourceType, evidence, state) : [];
  }

  if (utilityName === "Exclude" || utilityName === "Extract") {
    if (!sourceType || !filterType) {
      return [];
    }

    const sourceValues = resolveFiniteStringType(sourceType, evidence, state);
    const filterValues = new Set(
      resolveFiniteStringType(filterType, evidence, {
        seenTypeNames: new Set(),
      }),
    );
    if (filterValues.size === 0 && filterType.kind !== ts.SyntaxKind.NeverKeyword) {
      return [];
    }

    return utilityName === "Exclude"
      ? sourceValues.filter((value) => !filterValues.has(value))
      : sourceValues.filter((value) => filterValues.has(value));
  }

  return undefined;
}

function resolveImportedTypeDeclaration(
  typeName: string,
  evidence: LocalTypeEvidence,
  state: TypeResolutionState,
): FiniteResolvedTypeDeclaration | undefined {
  const resolvedDeclaration = evidence.cache
    ? resolveTypeDeclaration({
        symbolResolution: evidence.cache.symbolResolution,
        sourceFilesByFilePath: evidence.cache.sourceFilesByFilePath,
        filePath: evidence.filePath,
        localName: typeName,
      })
    : undefined;
  if (!resolvedDeclaration) {
    return undefined;
  }

  const normalizedFilePath = normalizeFilePath(resolvedDeclaration.binding.targetFilePath);
  const typeKey = createTypeKey(normalizedFilePath, resolvedDeclaration.binding.targetTypeName);
  if (state.seenTypeNames.has(typeKey)) {
    return undefined;
  }

  if (!evidence.cache) {
    return undefined;
  }

  const targetEvidence = getLocalTypeEvidence(
    normalizedFilePath,
    resolvedDeclaration.declaration.getSourceFile(),
    evidence.cache,
  );
  if (resolvedDeclaration.kind === "type-alias") {
    return {
      kind: "type-alias",
      type: resolvedDeclaration.declaration.type,
      evidence: targetEvidence,
    };
  }

  return {
    kind: "interface",
    declaration: resolvedDeclaration.declaration,
    evidence: targetEvidence,
  };
}

function unwrapConstExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function unwrapTypeNode(typeNode: ts.TypeNode): ts.TypeNode {
  let current = typeNode;
  while (ts.isParenthesizedTypeNode(current)) {
    current = current.type;
  }

  return current;
}

function createTypeKey(filePath: string, typeName: string): string {
  return `${normalizeFilePath(filePath)}:${typeName}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function getStaticPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
}
