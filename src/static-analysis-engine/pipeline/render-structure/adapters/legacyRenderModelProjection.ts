import { graphToReactRenderSyntaxInputs } from "../../fact-graph/index.js";
import { buildRenderModel } from "../../render-model/index.js";
import { collectRenderRegionsFromSubtrees } from "../../render-model/render-ir/index.js";
import {
  renderedComponentBoundaryId,
  renderedComponentId,
  renderedElementId,
  renderPathId,
  renderRegionId,
} from "../ids.js";
import type { RenderGraphEdge, RenderGraphNode } from "../../render-model/render-graph/index.js";
import type {
  RenderComponentReferenceNode,
  RenderElementNode,
  RenderNode,
  RenderRegion as LegacyRenderRegion,
  RenderSubtree,
} from "../../render-model/render-ir/index.js";
import type {
  RenderCertainty,
  RenderGraphProjection,
  RenderGraphProjectionEdge,
  RenderGraphProjectionNode,
  RenderPath,
  RenderPathSegment,
  RenderRegion,
  RenderStructureDiagnostic,
  RenderStructureInput,
  RenderedComponent,
  RenderedComponentBoundary,
  RenderedElement,
} from "../types.js";
import type { SourceAnchor } from "../../../types/core.js";

type ProjectionAccumulator = {
  componentBoundaries: RenderedComponentBoundary[];
  elements: RenderedElement[];
  renderPaths: RenderPath[];
  boundaryById: Map<string, RenderedComponentBoundary>;
  elementById: Map<string, RenderedElement>;
  rootBoundaryIdByComponentKey: Map<string, string>;
  rootBoundaryIdBySubtreeKey: Map<string, string>;
};

type TraversalContext = {
  rootComponentNodeId?: string;
  boundaryId: string;
  parentElementId?: string;
  pathSegments: RenderPathSegment[];
  certainty: RenderCertainty;
};

export function projectLegacyRenderModel(input: RenderStructureInput): {
  components: RenderedComponent[];
  componentBoundaries: RenderedComponentBoundary[];
  elements: RenderedElement[];
  emissionSites: [];
  renderPaths: RenderPath[];
  placementConditions: [];
  renderRegions: RenderRegion[];
  renderGraph: RenderGraphProjection;
  diagnostics: RenderStructureDiagnostic[];
} {
  if (!input.legacy) {
    return emptyProjection();
  }

  const legacyModel = buildRenderModel({
    parsedFiles: input.legacy.parsedFiles,
    reactRenderSyntax: graphToReactRenderSyntaxInputs(input.graph),
    symbolResolution: input.legacy.symbolResolution,
    moduleFacts: input.legacy.moduleFacts,
    includeTraces: input.options?.includeTraces,
  });
  const accumulator: ProjectionAccumulator = {
    componentBoundaries: [],
    elements: [],
    renderPaths: [],
    boundaryById: new Map(),
    elementById: new Map(),
    rootBoundaryIdByComponentKey: new Map(),
    rootBoundaryIdBySubtreeKey: new Map(),
  };

  for (const [index, subtree] of legacyModel.renderSubtrees.entries()) {
    projectSubtree({
      graph: input.graph,
      subtree,
      subtreeIndex: index,
      accumulator,
    });
  }

  const components = projectComponents({
    graph: input.graph,
    renderGraphNodes: legacyModel.renderGraph.nodes,
    rootBoundaryIdByComponentKey: accumulator.rootBoundaryIdByComponentKey,
  });
  const renderGraph = projectRenderGraph(legacyModel.renderGraph);
  const regionProjection = projectRenderRegions({
    graph: input.graph,
    legacyRegions: collectRenderRegionsFromSubtrees(legacyModel.renderSubtrees),
    rootBoundaryIdByComponentKey: accumulator.rootBoundaryIdByComponentKey,
    rootBoundaryIdBySubtreeKey: accumulator.rootBoundaryIdBySubtreeKey,
  });
  accumulator.renderPaths.push(...regionProjection.renderPaths);

  return {
    components,
    componentBoundaries: sortById(accumulator.componentBoundaries),
    elements: sortById(accumulator.elements),
    emissionSites: [],
    renderPaths: sortById(accumulator.renderPaths),
    placementConditions: [],
    renderRegions: regionProjection.renderRegions,
    renderGraph,
    diagnostics: [],
  };
}

function emptyProjection(): ReturnType<typeof projectLegacyRenderModel> {
  return {
    components: [],
    componentBoundaries: [],
    elements: [],
    emissionSites: [],
    renderPaths: [],
    placementConditions: [],
    renderRegions: [],
    renderGraph: { nodes: [], edges: [] },
    diagnostics: [],
  };
}

function projectSubtree(input: {
  graph: RenderStructureInput["graph"];
  subtree: RenderSubtree;
  subtreeIndex: number;
  accumulator: ProjectionAccumulator;
}): void {
  const componentNodeId = input.subtree.componentKey
    ? input.graph.indexes.componentNodeIdByComponentKey.get(input.subtree.componentKey)
    : undefined;
  const subtreeKey = createSubtreeKey(input.subtree, input.subtreeIndex);
  const rootBoundaryId = renderedComponentBoundaryId({
    boundaryKind: "component-root",
    key: input.subtree.componentKey ?? subtreeKey,
  });
  const rootPath = createRenderPath({
    id: renderPathId({
      terminalKind: "component-boundary",
      terminalId: rootBoundaryId,
    }),
    rootComponentNodeId: componentNodeId,
    terminalKind: "component-boundary",
    terminalId: rootBoundaryId,
    segments: [
      {
        kind: "component-root",
        ...(componentNodeId ? { componentNodeId } : {}),
        location: normalizeAnchor(input.subtree.sourceAnchor),
      },
    ],
    certainty: "definite",
  });
  const boundary: RenderedComponentBoundary = {
    id: rootBoundaryId,
    boundaryKind: "component-root",
    ...(componentNodeId ? { componentNodeId } : {}),
    ...(input.subtree.componentKey ? { componentKey: input.subtree.componentKey } : {}),
    ...(input.subtree.componentName ? { componentName: input.subtree.componentName } : {}),
    filePath: normalizeProjectPath(input.subtree.sourceAnchor.filePath),
    declarationLocation: normalizeAnchor(input.subtree.sourceAnchor),
    childBoundaryIds: [],
    rootElementIds: [],
    renderPathId: rootPath.id,
    placementConditionIds: [],
    expansion: { status: "root" },
    traces: [],
  };

  input.accumulator.rootBoundaryIdBySubtreeKey.set(subtreeKey, rootBoundaryId);
  if (input.subtree.componentKey) {
    input.accumulator.rootBoundaryIdByComponentKey.set(input.subtree.componentKey, rootBoundaryId);
  }
  addBoundary(input.accumulator, boundary);
  addRenderPath(input.accumulator, rootPath);
  projectNode({
    node: input.subtree.root,
    accumulator: input.accumulator,
    context: {
      rootComponentNodeId: componentNodeId,
      boundaryId: rootBoundaryId,
      pathSegments: rootPath.segments,
      certainty: "definite",
    },
  });
}

function projectNode(input: {
  node: RenderNode;
  accumulator: ProjectionAccumulator;
  context: TraversalContext;
}): string[] {
  if (input.node.expandedFromComponentReference) {
    return projectExpandedComponentBoundary(input);
  }

  if (input.node.kind === "component-reference") {
    projectUnresolvedComponentBoundary({
      node: input.node,
      accumulator: input.accumulator,
      context: input.context,
    });
    return [];
  }

  if (input.node.kind === "element") {
    return projectElement({
      node: input.node,
      accumulator: input.accumulator,
      context: input.context,
    });
  }

  if (input.node.kind === "fragment") {
    const rootElementIds: string[] = [];
    input.node.children.forEach((child, childIndex) => {
      rootElementIds.push(
        ...projectNode({
          node: child,
          accumulator: input.accumulator,
          context: {
            ...input.context,
            pathSegments: [
              ...input.context.pathSegments,
              { kind: "child-index", index: childIndex },
            ],
          },
        }),
      );
    });
    return rootElementIds;
  }

  if (input.node.kind === "conditional") {
    return [
      ...projectNode({
        node: input.node.whenTrue,
        accumulator: input.accumulator,
        context: {
          ...input.context,
          certainty: downgradeCertainty(input.context.certainty),
          pathSegments: [
            ...input.context.pathSegments,
            {
              kind: "unknown-barrier",
              reason: `conditional-branch:when-true:${input.node.conditionSourceText}`,
              location: normalizeAnchor(input.node.sourceAnchor),
            },
          ],
        },
      }),
      ...projectNode({
        node: input.node.whenFalse,
        accumulator: input.accumulator,
        context: {
          ...input.context,
          certainty: downgradeCertainty(input.context.certainty),
          pathSegments: [
            ...input.context.pathSegments,
            {
              kind: "unknown-barrier",
              reason: `conditional-branch:when-false:${input.node.conditionSourceText}`,
              location: normalizeAnchor(input.node.sourceAnchor),
            },
          ],
        },
      }),
    ];
  }

  if (input.node.kind === "repeated-region") {
    return projectNode({
      node: input.node.template,
      accumulator: input.accumulator,
      context: {
        ...input.context,
        certainty: downgradeCertainty(input.context.certainty),
        pathSegments: [
          ...input.context.pathSegments,
          {
            kind: "unknown-barrier",
            reason: `repeated-template:${input.node.reason}`,
            location: normalizeAnchor(input.node.sourceAnchor),
          },
        ],
      },
    });
  }

  return [];
}

function projectExpandedComponentBoundary(input: {
  node: RenderNode;
  accumulator: ProjectionAccumulator;
  context: TraversalContext;
}): string[] {
  const expansion = input.node.expandedFromComponentReference;
  if (!expansion) {
    return projectNode(input);
  }

  const boundaryId = renderedComponentBoundaryId({
    boundaryKind: "expanded-component-reference",
    key: `${expansion.componentKey}:${anchorKey(expansion.sourceAnchor)}`,
  });
  const pathSegments: RenderPathSegment[] = [
    ...input.context.pathSegments,
    {
      kind: "component-reference",
      location: normalizeAnchor(expansion.sourceAnchor),
    },
  ];
  const path = createRenderPath({
    id: renderPathId({
      terminalKind: "component-boundary",
      terminalId: boundaryId,
    }),
    rootComponentNodeId: input.context.rootComponentNodeId,
    terminalKind: "component-boundary",
    terminalId: boundaryId,
    segments: pathSegments,
    certainty: input.context.certainty,
    traces: expansion.traces,
  });
  const boundary: RenderedComponentBoundary = {
    id: boundaryId,
    boundaryKind: "expanded-component-reference",
    componentKey: expansion.componentKey,
    componentName: expansion.componentName,
    filePath: normalizeProjectPath(expansion.filePath),
    declarationLocation: normalizeAnchor(expansion.targetSourceAnchor),
    referenceLocation: normalizeAnchor(expansion.sourceAnchor),
    parentBoundaryId: input.context.boundaryId,
    ...(input.context.parentElementId ? { parentElementId: input.context.parentElementId } : {}),
    childBoundaryIds: [],
    rootElementIds: [],
    renderPathId: path.id,
    placementConditionIds: [],
    expansion: { status: "expanded", reason: "legacy-render-model-expansion" },
    traces: expansion.traces,
  };

  addBoundary(input.accumulator, boundary);
  addRenderPath(input.accumulator, path);
  linkBoundaryToParent(input.accumulator, boundary);

  const rootElementIds = projectNode({
    node: {
      ...input.node,
      expandedFromComponentReference: undefined,
    } as RenderNode,
    accumulator: input.accumulator,
    context: {
      rootComponentNodeId: input.context.rootComponentNodeId,
      boundaryId,
      parentElementId: input.context.parentElementId,
      pathSegments,
      certainty: input.context.certainty,
    },
  });
  boundary.rootElementIds = uniqueSorted(rootElementIds);
  return rootElementIds;
}

function projectUnresolvedComponentBoundary(input: {
  node: RenderComponentReferenceNode;
  accumulator: ProjectionAccumulator;
  context: TraversalContext;
}): void {
  const boundaryId = renderedComponentBoundaryId({
    boundaryKind: "unresolved-component-reference",
    key: `${input.node.componentName}:${anchorKey(input.node.sourceAnchor)}`,
  });
  const pathSegments: RenderPathSegment[] = [
    ...input.context.pathSegments,
    {
      kind: "component-reference",
      location: normalizeAnchor(input.node.sourceAnchor),
    },
  ];
  const path = createRenderPath({
    id: renderPathId({
      terminalKind: "component-boundary",
      terminalId: boundaryId,
    }),
    rootComponentNodeId: input.context.rootComponentNodeId,
    terminalKind: "component-boundary",
    terminalId: boundaryId,
    segments: pathSegments,
    certainty: "unknown",
    traces: input.node.traces ?? [],
  });
  const boundary: RenderedComponentBoundary = {
    id: boundaryId,
    boundaryKind: "unresolved-component-reference",
    ...(input.node.componentKey ? { componentKey: input.node.componentKey } : {}),
    componentName: input.node.componentName,
    referenceLocation: normalizeAnchor(input.node.sourceAnchor),
    parentBoundaryId: input.context.boundaryId,
    ...(input.context.parentElementId ? { parentElementId: input.context.parentElementId } : {}),
    childBoundaryIds: [],
    rootElementIds: [],
    renderPathId: path.id,
    placementConditionIds: [],
    expansion: { status: "unresolved", reason: input.node.reason },
    traces: input.node.traces ?? [],
  };

  addBoundary(input.accumulator, boundary);
  addRenderPath(input.accumulator, path);
  linkBoundaryToParent(input.accumulator, boundary);
}

function projectElement(input: {
  node: RenderElementNode;
  accumulator: ProjectionAccumulator;
  context: TraversalContext;
}): string[] {
  const elementId = renderedElementId({
    key: `${input.context.boundaryId}:${anchorKey(input.node.sourceAnchor)}`,
    tagName: input.node.tagName,
  });
  const pathSegments: RenderPathSegment[] = [
    ...input.context.pathSegments,
    {
      kind: "element",
      elementId,
      tagName: input.node.tagName,
      location: normalizeAnchor(input.node.sourceAnchor),
    },
  ];
  const path = createRenderPath({
    id: renderPathId({
      terminalKind: "element",
      terminalId: elementId,
    }),
    rootComponentNodeId: input.context.rootComponentNodeId,
    terminalKind: "element",
    terminalId: elementId,
    segments: pathSegments,
    certainty: input.context.certainty,
    traces: input.node.traces ?? [],
  });
  const element: RenderedElement = {
    id: elementId,
    tagName: input.node.tagName,
    sourceLocation: normalizeAnchor(input.node.sourceAnchor),
    ...(input.context.parentElementId ? { parentElementId: input.context.parentElementId } : {}),
    parentBoundaryId: input.context.boundaryId,
    childElementIds: [],
    childBoundaryIds: [],
    emissionSiteIds: [],
    renderPathId: path.id,
    placementConditionIds: [],
    certainty: input.context.certainty,
    traces: input.node.traces ?? [],
  };

  addElement(input.accumulator, element);
  addRenderPath(input.accumulator, path);
  linkElementToParent(input.accumulator, element);

  input.node.children.forEach((child, childIndex) => {
    projectNode({
      node: child,
      accumulator: input.accumulator,
      context: {
        ...input.context,
        parentElementId: elementId,
        pathSegments: [...pathSegments, { kind: "child-index", index: childIndex }],
      },
    });
  });

  return [elementId];
}

function projectComponents(input: {
  graph: RenderStructureInput["graph"];
  renderGraphNodes: RenderGraphNode[];
  rootBoundaryIdByComponentKey: Map<string, string>;
}): RenderedComponent[] {
  return input.renderGraphNodes
    .map((node) => {
      const componentNodeId = input.graph.indexes.componentNodeIdByComponentKey.get(
        node.componentKey,
      );
      return {
        id: renderedComponentId(node.componentKey),
        ...(componentNodeId ? { componentNodeId } : {}),
        componentKey: node.componentKey,
        componentName: node.componentName,
        filePath: normalizeProjectPath(node.filePath),
        exported: node.exported,
        declarationLocation: normalizeAnchor(node.sourceAnchor),
        rootBoundaryIds: uniqueSorted(
          [input.rootBoundaryIdByComponentKey.get(node.componentKey)].filter((id): id is string =>
            Boolean(id),
          ),
        ),
        provenance: [
          {
            stage: "render-structure" as const,
            filePath: normalizeProjectPath(node.filePath),
            anchor: normalizeAnchor(node.sourceAnchor),
            upstreamId: componentNodeId,
            summary: "Projected component from legacy render graph node",
          },
        ],
        traces: [],
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function projectRenderGraph(input: {
  nodes: RenderGraphNode[];
  edges: RenderGraphEdge[];
}): RenderGraphProjection {
  return {
    nodes: input.nodes.map(projectRenderGraphNode).sort(compareRenderGraphNodes),
    edges: input.edges.map(projectRenderGraphEdge).sort(compareRenderGraphEdges),
  };
}

function projectRenderGraphNode(node: RenderGraphNode): RenderGraphProjectionNode {
  return {
    componentKey: node.componentKey,
    componentName: node.componentName,
    filePath: normalizeProjectPath(node.filePath),
    exported: node.exported,
    sourceLocation: normalizeAnchor(node.sourceAnchor),
  };
}

function projectRenderGraphEdge(edge: RenderGraphEdge): RenderGraphProjectionEdge {
  return {
    fromComponentKey: edge.fromComponentKey,
    fromComponentName: edge.fromComponentName,
    fromFilePath: normalizeProjectPath(edge.fromFilePath),
    ...(edge.toComponentKey ? { toComponentKey: edge.toComponentKey } : {}),
    toComponentName: edge.toComponentName,
    ...(edge.toFilePath ? { toFilePath: normalizeProjectPath(edge.toFilePath) } : {}),
    ...(edge.targetSourceAnchor
      ? { targetLocation: normalizeAnchor(edge.targetSourceAnchor) }
      : {}),
    sourceLocation: normalizeAnchor(edge.sourceAnchor),
    resolution: edge.resolution,
    traversal: "render-structure",
    renderPath: edge.renderPath,
    traces: edge.traces,
  };
}

function projectRenderRegions(input: {
  graph: RenderStructureInput["graph"];
  legacyRegions: LegacyRenderRegion[];
  rootBoundaryIdByComponentKey: Map<string, string>;
  rootBoundaryIdBySubtreeKey: Map<string, string>;
}): {
  renderRegions: RenderRegion[];
  renderPaths: RenderPath[];
} {
  const renderPaths: RenderPath[] = [];
  const renderRegions = input.legacyRegions
    .map((region, index) => {
      const boundaryId =
        (region.componentKey
          ? input.rootBoundaryIdByComponentKey.get(region.componentKey)
          : undefined) ??
        input.rootBoundaryIdBySubtreeKey.get(createLegacyRegionSubtreeKey(region)) ??
        renderedComponentBoundaryId({
          boundaryKind: "component-root",
          key: `${region.componentName ?? "unknown"}:${index}`,
        });
      const componentNodeId = region.componentKey
        ? input.graph.indexes.componentNodeIdByComponentKey.get(region.componentKey)
        : undefined;
      const id = renderRegionId({
        regionKind: projectRegionKind(region.kind),
        key: `${region.componentKey ?? region.componentName ?? "unknown"}:${serializeLegacyRegionPath(region.path)}:${anchorKey(region.sourceAnchor)}`,
        index,
      });
      const path = createRenderPath({
        id: renderPathId({
          terminalKind: region.kind === "subtree-root" ? "component-boundary" : "unknown-region",
          terminalId: id,
        }),
        rootComponentNodeId: componentNodeId,
        terminalKind: region.kind === "subtree-root" ? "component-boundary" : "unknown-region",
        terminalId: id,
        segments: [
          {
            kind: "component-root",
            ...(componentNodeId ? { componentNodeId } : {}),
            location: normalizeAnchor(region.sourceAnchor),
          },
        ],
        certainty: region.kind === "subtree-root" ? "definite" : "possible",
      });
      renderPaths.push(path);

      return {
        id,
        regionKind: projectRegionKind(region.kind),
        boundaryId,
        ...(componentNodeId ? { componentNodeId } : {}),
        renderPathId: path.id,
        sourceLocation: normalizeAnchor(region.sourceAnchor),
        placementConditionIds: [],
        childElementIds: [],
        childBoundaryIds: [],
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    renderRegions,
    renderPaths: sortById(renderPaths),
  };
}

function addBoundary(
  accumulator: ProjectionAccumulator,
  boundary: RenderedComponentBoundary,
): void {
  accumulator.boundaryById.set(boundary.id, boundary);
  accumulator.componentBoundaries.push(boundary);
}

function addElement(accumulator: ProjectionAccumulator, element: RenderedElement): void {
  accumulator.elementById.set(element.id, element);
  accumulator.elements.push(element);
}

function addRenderPath(accumulator: ProjectionAccumulator, renderPath: RenderPath): void {
  accumulator.renderPaths.push(renderPath);
}

function linkBoundaryToParent(
  accumulator: ProjectionAccumulator,
  boundary: RenderedComponentBoundary,
): void {
  if (boundary.parentElementId) {
    const parentElement = accumulator.elementById.get(boundary.parentElementId);
    if (parentElement) {
      parentElement.childBoundaryIds = uniqueSorted([
        ...parentElement.childBoundaryIds,
        boundary.id,
      ]);
    }
    return;
  }

  if (boundary.parentBoundaryId) {
    const parentBoundary = accumulator.boundaryById.get(boundary.parentBoundaryId);
    if (parentBoundary) {
      parentBoundary.childBoundaryIds = uniqueSorted([
        ...parentBoundary.childBoundaryIds,
        boundary.id,
      ]);
    }
  }
}

function linkElementToParent(accumulator: ProjectionAccumulator, element: RenderedElement): void {
  if (element.parentElementId) {
    const parentElement = accumulator.elementById.get(element.parentElementId);
    if (parentElement) {
      parentElement.childElementIds = uniqueSorted([...parentElement.childElementIds, element.id]);
    }
    return;
  }

  const parentBoundary = accumulator.boundaryById.get(element.parentBoundaryId);
  if (parentBoundary) {
    parentBoundary.rootElementIds = uniqueSorted([...parentBoundary.rootElementIds, element.id]);
  }
}

function createRenderPath(
  input: Omit<RenderPath, "placementConditionIds" | "traces"> &
    Partial<Pick<RenderPath, "placementConditionIds" | "traces">>,
): RenderPath {
  return {
    ...input,
    placementConditionIds: input.placementConditionIds ?? [],
    traces: input.traces ?? [],
  };
}

function projectRegionKind(kind: LegacyRenderRegion["kind"]): RenderRegion["regionKind"] {
  if (kind === "subtree-root") {
    return "component-root";
  }

  return kind;
}

function downgradeCertainty(certainty: RenderCertainty): RenderCertainty {
  return certainty === "unknown" ? "unknown" : "possible";
}

function compareRenderGraphNodes(
  left: RenderGraphProjectionNode,
  right: RenderGraphProjectionNode,
): number {
  return (
    left.filePath.localeCompare(right.filePath) ||
    left.componentKey.localeCompare(right.componentKey) ||
    left.componentName.localeCompare(right.componentName) ||
    compareAnchors(left.sourceLocation, right.sourceLocation)
  );
}

function compareRenderGraphEdges(
  left: RenderGraphProjectionEdge,
  right: RenderGraphProjectionEdge,
): number {
  return (
    left.fromFilePath.localeCompare(right.fromFilePath) ||
    left.fromComponentKey.localeCompare(right.fromComponentKey) ||
    left.fromComponentName.localeCompare(right.fromComponentName) ||
    compareAnchors(left.sourceLocation, right.sourceLocation) ||
    (left.toComponentKey ?? "").localeCompare(right.toComponentKey ?? "") ||
    left.toComponentName.localeCompare(right.toComponentName) ||
    (left.toFilePath ?? "").localeCompare(right.toFilePath ?? "")
  );
}

function compareAnchors(left: SourceAnchor, right: SourceAnchor): number {
  return (
    left.filePath.localeCompare(right.filePath) ||
    left.startLine - right.startLine ||
    left.startColumn - right.startColumn ||
    (left.endLine ?? 0) - (right.endLine ?? 0) ||
    (left.endColumn ?? 0) - (right.endColumn ?? 0)
  );
}

function createSubtreeKey(subtree: RenderSubtree, index: number): string {
  return `${subtree.componentKey ?? subtree.componentName ?? "anonymous"}:${anchorKey(subtree.sourceAnchor)}:${index}`;
}

function createLegacyRegionSubtreeKey(region: LegacyRenderRegion): string {
  return `${region.componentKey ?? region.componentName ?? "anonymous"}:${anchorKey(region.sourceAnchor)}:0`;
}

function serializeLegacyRegionPath(path: LegacyRenderRegion["path"]): string {
  return path
    .map((segment) => {
      if (segment.kind === "root") {
        return "root";
      }

      if (segment.kind === "fragment-child") {
        return `fragment-child:${segment.childIndex}`;
      }

      if (segment.kind === "conditional-branch") {
        return `conditional-branch:${segment.branch}`;
      }

      return "repeated-template";
    })
    .join("/");
}

function anchorKey(anchor: SourceAnchor): string {
  return [
    normalizeProjectPath(anchor.filePath),
    anchor.startLine,
    anchor.startColumn,
    anchor.endLine ?? "",
    anchor.endColumn ?? "",
  ].join(":");
}

function normalizeAnchor(anchor: SourceAnchor): SourceAnchor {
  return {
    ...anchor,
    filePath: normalizeProjectPath(anchor.filePath),
  };
}

function normalizeProjectPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sortById<T extends { id: string }>(values: T[]): T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}
