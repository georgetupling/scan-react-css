import type { EngineSymbol, ProjectBindingResolution, SymbolSpace } from "../types.js";
import { findSymbolByLocalNameAndSpace } from "./shared.js";

export function getSymbol(input: {
  symbolResolution: ProjectBindingResolution;
  filePath: string;
  localName: string;
  symbolSpace: SymbolSpace;
}): EngineSymbol | undefined {
  return findSymbolByLocalNameAndSpace({
    symbolsByFilePath: input.symbolResolution.symbolsByFilePath,
    filePath: input.filePath,
    localName: input.localName,
    symbolSpace: input.symbolSpace,
  });
}
