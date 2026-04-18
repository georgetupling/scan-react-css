export type EngineModuleId = string;
export type EngineSymbolId = string;

export type SourceAnchor = {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine?: number;
  endColumn?: number;
};
