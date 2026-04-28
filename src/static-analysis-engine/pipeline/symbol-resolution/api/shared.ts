import type { EngineSymbolId } from "../../../types/core.js";
import type { EngineSymbol, SymbolSpace } from "../types.js";

export function findTypeSymbolByLocalName(input: {
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  filePath: string;
  localName: string;
}): EngineSymbol | undefined {
  return findSymbolByLocalNameAndSpace({
    symbolsByFilePath: input.symbolsByFilePath,
    filePath: input.filePath,
    localName: input.localName,
    symbolSpace: "type",
  });
}

export function findSymbolByLocalNameAndSpace(input: {
  symbolsByFilePath: Map<string, Map<EngineSymbolId, EngineSymbol>>;
  filePath: string;
  localName: string;
  symbolSpace: SymbolSpace;
}): EngineSymbol | undefined {
  for (const symbol of input.symbolsByFilePath.get(input.filePath)?.values() ?? []) {
    if (symbol.localName !== input.localName) {
      continue;
    }

    if (input.symbolSpace === "type" ? isTypeSymbol(symbol) : !isTypeSymbol(symbol)) {
      return symbol;
    }
  }

  return undefined;
}

function isTypeSymbol(symbol: EngineSymbol): boolean {
  return symbol.kind === "type-alias" || symbol.kind === "interface";
}
