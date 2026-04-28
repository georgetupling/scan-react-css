import type { EngineModuleId } from "../../../types/core.js";
import type {
  ModuleFactsDeclarationIndex,
  ModuleFactsImportRecord,
  ModuleFactsValueDeclaration,
  ResolvedTopLevelBindingFact,
} from "../types.js";
import { createModuleFactsBindingId } from "./moduleIds.js";

export function normalizeTopLevelBindings(input: {
  moduleId: EngineModuleId;
  imports: ModuleFactsImportRecord[];
  declarations: ModuleFactsDeclarationIndex | undefined;
}): ResolvedTopLevelBindingFact[] {
  const bindings = new Map<string, ResolvedTopLevelBindingFact>();

  for (const importRecord of input.imports) {
    for (const importName of importRecord.importNames) {
      bindings.set(importName.localName, {
        localName: importName.localName,
        bindingId: createModuleFactsBindingId(input.moduleId, importName.localName),
        bindingKind:
          importName.kind === "default"
            ? "import-default"
            : importName.kind === "namespace"
              ? "import-namespace"
              : "import-named",
      });
    }
  }

  if (input.declarations) {
    for (const [localName, declaration] of input.declarations.valueDeclarations.entries()) {
      bindings.set(localName, {
        localName,
        bindingId: createModuleFactsBindingId(input.moduleId, localName),
        bindingKind: toTopLevelBindingKind(declaration),
      });
    }
  }

  return [...bindings.values()].sort(compareTopLevelBindings);
}

function toTopLevelBindingKind(
  declaration: ModuleFactsValueDeclaration,
): ResolvedTopLevelBindingFact["bindingKind"] {
  if (declaration.kind === "function") {
    return "function";
  }

  if (declaration.kind === "class") {
    return "class";
  }

  if (declaration.kind === "namespace") {
    return "namespace";
  }

  if (declaration.kind === "enum" || declaration.kind === "const-enum") {
    return "enum";
  }

  return "variable";
}

function compareTopLevelBindings(
  left: ResolvedTopLevelBindingFact,
  right: ResolvedTopLevelBindingFact,
): number {
  return (
    left.localName.localeCompare(right.localName) ||
    left.bindingKind.localeCompare(right.bindingKind)
  );
}
