import {
  collectRenderRegionsFromSubtrees,
  type RenderRegion,
  type RenderSubtree,
} from "../render-model/render-ir/index.js";
import type { RenderGraph } from "../render-model/render-graph/types.js";
import type { RenderModel } from "../render-structure/index.js";
import type {
  ReachabilityComponentRoot,
  ReachabilityGraphContext,
  PlacedChildRenderRegion,
  UnknownReachabilityBarrier,
} from "./internalTypes.js";
import { normalizeProjectPath } from "./pathUtils.js";
import { compareEdges, serializeRegionPath } from "./sortAndKeys.js";

export function buildReachabilityGraphContext(input: {
  renderGraph: RenderGraph;
  renderSubtrees?: RenderSubtree[];
  renderModel?: RenderModel;
}): ReachabilityGraphContext {
  const renderRegionsByComponentKey = new Map<string, RenderRegion[]>();
  const renderRegionsByPathKeyByComponentKey = new Map<string, Map<string, RenderRegion[]>>();
  const componentRootsByComponentKey = new Map<string, ReachabilityComponentRoot>();
  const unknownBarriersByComponentKey = new Map<string, UnknownReachabilityBarrier[]>();
  const renderGraphNodesByKey = new Map(
    input.renderGraph.nodes.map((node) => [node.componentKey, node]),
  );
  const outgoingEdgesByComponentKey = new Map<
    string,
    import("../render-model/render-graph/types.js").RenderGraphEdge[]
  >();
  const incomingEdgesByComponentKey = new Map<
    string,
    import("../render-model/render-graph/types.js").RenderGraphEdge[]
  >();
  const componentKeysByFilePath = new Map<string, string[]>();

  const projected = input.renderModel
    ? projectFromRenderModel(input.renderModel, renderGraphNodesByKey)
    : undefined;
  const effectiveRegions =
    projected?.renderRegions ?? collectRenderRegionsFromSubtrees(input.renderSubtrees ?? []);

  for (const renderRegion of effectiveRegions) {
    if (!renderRegion.componentKey) {
      continue;
    }

    const componentKey = renderRegion.componentKey;
    const renderRegions = renderRegionsByComponentKey.get(componentKey) ?? [];
    renderRegions.push(renderRegion);
    renderRegionsByComponentKey.set(componentKey, renderRegions);

    const pathKey = serializeRegionPath(renderRegion.path);
    const renderRegionsByPathKey =
      renderRegionsByPathKeyByComponentKey.get(componentKey) ?? new Map();
    const matchingPathRegions = renderRegionsByPathKey.get(pathKey) ?? [];
    matchingPathRegions.push(renderRegion);
    renderRegionsByPathKey.set(pathKey, matchingPathRegions);
    renderRegionsByPathKeyByComponentKey.set(componentKey, renderRegionsByPathKey);
  }

  if (projected) {
    for (const [componentKey, root] of projected.componentRootsByComponentKey.entries()) {
      componentRootsByComponentKey.set(componentKey, root);
    }
    for (const [componentKey, barriers] of projected.unknownBarriersByComponentKey.entries()) {
      unknownBarriersByComponentKey.set(componentKey, barriers);
    }
  } else {
    for (const renderSubtree of input.renderSubtrees ?? []) {
      if (!renderSubtree.componentKey || !renderSubtree.componentName) {
        continue;
      }
      const componentKey = renderSubtree.componentKey;
      componentRootsByComponentKey.set(componentKey, {
        filePath:
          normalizeProjectPath(renderSubtree.sourceAnchor.filePath) ??
          renderSubtree.sourceAnchor.filePath,
        componentKey: renderSubtree.componentKey,
        componentName: renderSubtree.componentName,
        rootSourceAnchor: renderSubtree.root.sourceAnchor,
        declarationSourceAnchor: renderSubtree.sourceAnchor,
      });
    }
  }

  for (const edge of input.renderGraph.edges) {
    if (edge.resolution !== "resolved" || !edge.toFilePath) {
      continue;
    }
    if (!edge.toComponentKey) {
      continue;
    }
    const outgoingEdges = outgoingEdgesByComponentKey.get(edge.fromComponentKey) ?? [];
    outgoingEdges.push(edge);
    outgoingEdgesByComponentKey.set(edge.fromComponentKey, outgoingEdges);
    const incomingEdges = incomingEdgesByComponentKey.get(edge.toComponentKey) ?? [];
    incomingEdges.push(edge);
    incomingEdgesByComponentKey.set(edge.toComponentKey, incomingEdges);
  }

  for (const [componentKey, node] of renderGraphNodesByKey.entries()) {
    const filePath = normalizeProjectPath(node.filePath) ?? node.filePath;
    const componentKeys = componentKeysByFilePath.get(filePath) ?? [];
    componentKeys.push(componentKey);
    componentKeysByFilePath.set(filePath, componentKeys);
  }

  for (const edges of outgoingEdgesByComponentKey.values()) edges.sort(compareEdges);
  for (const edges of incomingEdgesByComponentKey.values()) edges.sort(compareEdges);
  for (const componentKeys of componentKeysByFilePath.values()) {
    componentKeys.sort((left, right) => left.localeCompare(right));
  }

  const placedChildRenderRegionsByComponentKey = buildPlacedChildRenderRegionsByComponentKey({
    renderRegionsByComponentKey,
    outgoingEdgesByComponentKey,
  });

  return {
    componentKeys: [...renderGraphNodesByKey.keys()].sort((left, right) =>
      left.localeCompare(right),
    ),
    renderRegionsByComponentKey,
    renderRegionsByPathKeyByComponentKey,
    componentRootsByComponentKey,
    unknownBarriersByComponentKey,
    placedChildRenderRegionsByComponentKey,
    renderGraphNodesByKey,
    outgoingEdgesByComponentKey,
    incomingEdgesByComponentKey,
    componentKeysByFilePath,
  };
}

function buildPlacedChildRenderRegionsByComponentKey(input: {
  renderRegionsByComponentKey: Map<string, RenderRegion[]>;
  outgoingEdgesByComponentKey: Map<
    string,
    import("../render-model/render-graph/types.js").RenderGraphEdge[]
  >;
}): Map<string, PlacedChildRenderRegion[]> {
  const placementsByComponentKey = new Map<string, PlacedChildRenderRegion[]>();
  for (const [componentKey, outgoingEdges] of input.outgoingEdgesByComponentKey.entries()) {
    const renderRegions = input.renderRegionsByComponentKey.get(componentKey) ?? [];
    const placements: PlacedChildRenderRegion[] = [];

    for (const edge of outgoingEdges) {
      const containingRenderRegions = renderRegions.filter((region) =>
        sourceAnchorContains(region.sourceAnchor, edge.sourceAnchor),
      );
      const fallbackRootRegion =
        containingRenderRegions.length === 0
          ? renderRegions.filter((region) => region.kind === "subtree-root")
          : [];
      const effectiveRegions =
        containingRenderRegions.length > 0 ? containingRenderRegions : fallbackRootRegion;
      if (effectiveRegions.length > 0) {
        placements.push({ edge, renderRegions: effectiveRegions });
      }
    }

    if (placements.length > 0) {
      placementsByComponentKey.set(componentKey, placements);
    }
  }
  return placementsByComponentKey;
}

function projectFromRenderModel(
  renderModel: RenderModel,
  renderGraphNodesByKey: Map<
    string,
    import("../render-model/render-graph/types.js").RenderGraphNode
  >,
): {
  renderRegions: RenderRegion[];
  componentRootsByComponentKey: Map<string, ReachabilityComponentRoot>;
  unknownBarriersByComponentKey: Map<string, UnknownReachabilityBarrier[]>;
} {
  const renderPathsById = new Map(renderModel.renderPaths.map((path) => [path.id, path]));
  const boundariesById = new Map(
    renderModel.componentBoundaries.map((boundary) => [boundary.id, boundary]),
  );
  const componentByNodeId = new Map(
    renderModel.components
      .filter((component) => component.componentNodeId)
      .map((component) => [component.componentNodeId as string, component]),
  );

  const renderRegions: RenderRegion[] = [];
  const unknownBarriersByComponentKey = new Map<string, UnknownReachabilityBarrier[]>();
  const componentRootsByComponentKey = new Map<string, ReachabilityComponentRoot>();

  for (const component of renderModel.components) {
    const node = renderGraphNodesByKey.get(component.componentKey);
    const firstBoundary = component.rootBoundaryIds
      .map((boundaryId) => boundariesById.get(boundaryId))
      .find((boundary): boundary is NonNullable<typeof boundary> => Boolean(boundary));
    const rootSourceAnchor = firstBoundary?.declarationLocation ?? component.declarationLocation;
    componentRootsByComponentKey.set(component.componentKey, {
      filePath: normalizeProjectPath(component.filePath) ?? component.filePath,
      componentKey: component.componentKey,
      componentName: component.componentName,
      rootSourceAnchor,
      declarationSourceAnchor: component.declarationLocation,
    });
    if (!node) {
      continue;
    }
  }

  for (const region of renderModel.renderRegions) {
    const boundary = boundariesById.get(region.boundaryId);
    const component =
      (region.componentNodeId ? componentByNodeId.get(region.componentNodeId) : undefined) ??
      undefined;
    if (!component) {
      continue;
    }
    const path = renderPathsById.get(region.renderPathId);
    const projectedPath = projectLegacyPath(path?.segments ?? []);
    const projectedKind =
      region.regionKind === "component-root"
        ? "subtree-root"
        : region.regionKind === "conditional-branch"
          ? "conditional-branch"
          : region.regionKind === "repeated-template"
            ? "repeated-template"
            : "conditional-branch";
    const projectedRegion: RenderRegion = {
      filePath: normalizeProjectPath(component.filePath) ?? component.filePath,
      componentKey: component.componentKey,
      componentName: component.componentName,
      kind: projectedKind,
      path: projectedPath.length > 0 ? projectedPath : [{ kind: "root" }],
      sourceAnchor: region.sourceLocation,
    };
    renderRegions.push(projectedRegion);

    if (region.regionKind === "unknown-barrier") {
      const barriers = unknownBarriersByComponentKey.get(component.componentKey) ?? [];
      barriers.push({
        node: {
          kind: "unknown",
          reason: "unknown-render-model-region",
          sourceAnchor: region.sourceLocation,
        } as import("../render-model/render-ir/types.js").RenderUnknownNode,
        path: projectedRegion.path,
        reason: "unknown-render-model-region",
        sourceAnchor: region.sourceLocation,
      });
      unknownBarriersByComponentKey.set(component.componentKey, barriers);
    }

    if (boundary?.boundaryKind === "unresolved-component-reference") {
      const unresolvedReason =
        boundary.expansion.status === "unresolved" ||
        boundary.expansion.status === "cycle" ||
        boundary.expansion.status === "budget-exceeded" ||
        boundary.expansion.status === "unsupported"
          ? boundary.expansion.reason
          : "unresolved-component-reference";
      const barriers = unknownBarriersByComponentKey.get(component.componentKey) ?? [];
      barriers.push({
        node: {
          kind: "component-reference",
          componentName: boundary.componentName ?? "unknown",
          componentKey: boundary.componentKey,
          reason: unresolvedReason,
          sourceAnchor: boundary.referenceLocation ?? region.sourceLocation,
        } as import("../render-model/render-ir/types.js").RenderComponentReferenceNode,
        path: projectedRegion.path,
        reason: unresolvedReason,
        sourceAnchor: boundary.referenceLocation ?? region.sourceLocation,
      });
      unknownBarriersByComponentKey.set(component.componentKey, barriers);
    }
  }

  return {
    renderRegions: renderRegions.sort((left, right) =>
      serializeRegionPath(left.path).localeCompare(serializeRegionPath(right.path)),
    ),
    componentRootsByComponentKey,
    unknownBarriersByComponentKey,
  };
}

function projectLegacyPath(
  segments: import("../render-structure/index.js").RenderPathSegment[],
): import("../render-model/render-ir/types.js").RenderRegionPathSegment[] {
  const result: import("../render-model/render-ir/types.js").RenderRegionPathSegment[] = [
    { kind: "root" },
  ];
  for (const segment of segments) {
    if (segment.kind === "child-index") {
      result.push({ kind: "fragment-child", childIndex: segment.index });
      continue;
    }
    if (segment.kind === "conditional-branch") {
      result.push({ kind: "conditional-branch", branch: segment.branch });
      continue;
    }
    if (segment.kind === "repeated-template") {
      result.push({ kind: "repeated-template" });
      continue;
    }
  }
  return result;
}

function sourceAnchorContains(
  containing: import("../../types/core.js").SourceAnchor,
  contained: import("../../types/core.js").SourceAnchor,
): boolean {
  const normalizedContainingFilePath = normalizeProjectPath(containing.filePath);
  const normalizedContainedFilePath = normalizeProjectPath(contained.filePath);
  if (normalizedContainingFilePath !== normalizedContainedFilePath) {
    return false;
  }
  const containingStart = toAnchorPositionValue(containing.startLine, containing.startColumn);
  const containingEnd = toAnchorPositionValue(
    containing.endLine ?? containing.startLine,
    containing.endColumn ?? containing.startColumn,
  );
  const containedStart = toAnchorPositionValue(contained.startLine, contained.startColumn);
  const containedEnd = toAnchorPositionValue(
    contained.endLine ?? contained.startLine,
    contained.endColumn ?? contained.startColumn,
  );
  return containingStart <= containedStart && containingEnd >= containedEnd;
}

function toAnchorPositionValue(line: number, column: number): number {
  return line * 1_000_000 + column;
}
