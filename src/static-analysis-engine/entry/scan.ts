import { collectClassExpressionSummaries } from "../pipeline/abstract-values/index.js";
import { buildModuleGraphFromSource, createModuleId } from "../pipeline/module-graph/index.js";
import { parseSourceFile } from "../pipeline/parse/index.js";
import { buildSameFileRenderSubtrees } from "../pipeline/render-ir/index.js";
import { collectTopLevelSymbols } from "../pipeline/symbol-resolution/index.js";
import type { StaticAnalysisEngineResult } from "../types/runtime.js";
import type { ModuleGraph } from "../pipeline/module-graph/index.js";
import type { ClassExpressionSummary } from "../pipeline/abstract-values/index.js";
import type { RenderSubtree } from "../pipeline/render-ir/index.js";
import type { EngineSymbol } from "../pipeline/symbol-resolution/index.js";
import type { EngineModuleId, EngineSymbolId } from "../types/core.js";
import type ts from "typescript";

export function analyzeSourceText(input: {
  filePath: string;
  sourceText: string;
}): StaticAnalysisEngineResult {
  const parseStage = runParseStage(input);
  const symbolResolutionStage = runSymbolResolutionStage({
    filePath: input.filePath,
    parsedSourceFile: parseStage.parsedSourceFile,
  });
  const moduleGraphStage = runModuleGraphStage({
    filePath: input.filePath,
    parsedSourceFile: parseStage.parsedSourceFile,
    moduleId: symbolResolutionStage.moduleId,
    symbols: symbolResolutionStage.symbols,
  });
  const abstractValueStage = runAbstractValueStage({
    filePath: input.filePath,
    parsedSourceFile: parseStage.parsedSourceFile,
  });
  const renderIrStage = runRenderIrStage({
    filePath: input.filePath,
    parsedSourceFile: parseStage.parsedSourceFile,
  });

  return {
    moduleGraph: moduleGraphStage.moduleGraph,
    symbols: symbolResolutionStage.symbols,
    classExpressions: abstractValueStage.classExpressions,
    renderSubtrees: renderIrStage.renderSubtrees,
  };
}

type ParseStageResult = {
  parsedSourceFile: ts.SourceFile;
};

type SymbolResolutionStageResult = {
  moduleId: EngineModuleId;
  symbols: Map<EngineSymbolId, EngineSymbol>;
};

type ModuleGraphStageResult = {
  moduleGraph: ModuleGraph;
};

type AbstractValueStageResult = {
  classExpressions: ClassExpressionSummary[];
};

type RenderIrStageResult = {
  renderSubtrees: RenderSubtree[];
};

function runParseStage(input: { filePath: string; sourceText: string }): ParseStageResult {
  return {
    parsedSourceFile: parseSourceFile(input),
  };
}

function runSymbolResolutionStage(input: {
  filePath: string;
  parsedSourceFile: ts.SourceFile;
}): SymbolResolutionStageResult {
  const moduleId = createModuleId(input.filePath);

  return {
    moduleId,
    symbols: collectTopLevelSymbols({
      filePath: input.filePath,
      parsedSourceFile: input.parsedSourceFile,
      moduleId,
    }),
  };
}

function runModuleGraphStage(input: {
  filePath: string;
  parsedSourceFile: ts.SourceFile;
  moduleId: EngineModuleId;
  symbols: Map<EngineSymbolId, EngineSymbol>;
}): ModuleGraphStageResult {
  const topLevelSymbolIds = [...input.symbols.keys()].sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    moduleGraph: buildModuleGraphFromSource({
      filePath: input.filePath,
      parsedSourceFile: input.parsedSourceFile,
      topLevelSymbolIds,
    }),
  };
}

function runAbstractValueStage(input: {
  filePath: string;
  parsedSourceFile: ts.SourceFile;
}): AbstractValueStageResult {
  return {
    classExpressions: collectClassExpressionSummaries(input),
  };
}

function runRenderIrStage(input: {
  filePath: string;
  parsedSourceFile: ts.SourceFile;
}): RenderIrStageResult {
  return {
    renderSubtrees: buildSameFileRenderSubtrees(input),
  };
}
