import type { SourceModuleSyntaxFacts } from "../module-syntax/index.js";

export function collectCssModuleNamespaceNames(moduleSyntax: SourceModuleSyntaxFacts): Set<string> {
  const names = new Set<string>();
  for (const importRecord of moduleSyntax.imports) {
    if (importRecord.importKind !== "css" || !/\.module\.[cm]?css$/i.test(importRecord.specifier)) {
      continue;
    }

    for (const importName of importRecord.importNames) {
      if (importName.kind === "default" || importName.kind === "namespace") {
        names.add(importName.localName);
      }
    }
  }
  return names;
}
