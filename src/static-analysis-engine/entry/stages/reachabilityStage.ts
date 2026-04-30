import { buildReachabilitySummary } from "../../pipeline/reachability/index.js";
import type { ExternalCssSummary } from "../../pipeline/external-css/index.js";
import {
  graphToReachabilityStylesheets,
  type FactGraphResult,
} from "../../pipeline/fact-graph/index.js";
import type { CssFrontendFacts } from "../../pipeline/language-frontends/index.js";
import type { ModuleFacts } from "../../pipeline/module-facts/index.js";
import type { RenderGraph } from "../../pipeline/render-model/render-graph/index.js";
import type { RenderSubtree } from "../../pipeline/render-model/render-ir/index.js";
import type { RenderModel } from "../../pipeline/render-structure/index.js";
import type { SelectorSourceInput } from "../../pipeline/selector-analysis/index.js";
import type { ProjectResourceEdge } from "../../pipeline/workspace-discovery/index.js";
import type { ReachabilityStageResult } from "./types.js";

export function runReachabilityStage(input: {
  moduleFacts: ModuleFacts;
  factGraph?: FactGraphResult;
  renderGraph: RenderGraph;
  renderSubtrees?: RenderSubtree[];
  renderModel?: RenderModel;
  css?: CssFrontendFacts;
  selectorCssSources: SelectorSourceInput[];
  resourceEdges?: ProjectResourceEdge[];
  externalCssSummary: ExternalCssSummary;
  includeTraces?: boolean;
}): ReachabilityStageResult {
  return {
    reachabilitySummary: buildReachabilitySummary({
      moduleFacts: input.moduleFacts,
      renderGraph: input.renderModel
        ? projectLegacyRenderGraphFromRenderModel(input.renderModel)
        : input.renderGraph,
      renderSubtrees: input.renderSubtrees,
      renderModel: input.renderModel,
      stylesheets: input.factGraph
        ? graphToReachabilityStylesheets(input.factGraph.graph)
        : (input.css?.files.map((file) => ({
            filePath: file.filePath,
            cssText: file.cssText,
          })) ?? input.selectorCssSources),
      resourceEdges: input.resourceEdges,
      externalCssSummary: input.externalCssSummary,
      includeTraces: input.includeTraces ?? true,
    }),
  };
}

function projectLegacyRenderGraphFromRenderModel(renderModel: RenderModel): RenderGraph {
  return {
    nodes: renderModel.renderGraph.nodes.map((node) => ({
      componentKey: node.componentKey,
      componentName: node.componentName,
      filePath: node.filePath,
      exported: node.exported,
      sourceAnchor: node.sourceLocation,
    })),
    edges: renderModel.renderGraph.edges.map((edge) => ({
      fromComponentKey: edge.fromComponentKey,
      fromComponentName: edge.fromComponentName,
      fromFilePath: edge.fromFilePath,
      toComponentKey: edge.toComponentKey,
      toComponentName: edge.toComponentName,
      toFilePath: edge.toFilePath,
      targetSourceAnchor: edge.targetLocation,
      sourceAnchor: edge.sourceLocation,
      resolution: edge.resolution,
      traversal: "render-ir",
      renderPath: edge.renderPath,
      traces: edge.traces,
    })),
  };
}
