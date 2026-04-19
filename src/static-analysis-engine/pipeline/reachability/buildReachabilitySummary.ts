import type { ModuleGraph } from "../module-graph/types.js";
import type { RenderGraph } from "../render-graph/types.js";
import {
  collectRenderRegionsFromSubtrees,
  type RenderRegion,
  type RenderSubtree,
} from "../render-ir/index.js";
import type { SelectorSourceInput } from "../selector-analysis/types.js";
import type {
  ReachabilityDerivation,
  ReachabilitySummary,
  StylesheetReachabilityContextRecord,
  StylesheetReachabilityRecord,
} from "./types.js";

export function buildReachabilitySummary(input: {
  moduleGraph: ModuleGraph;
  renderGraph: RenderGraph;
  renderSubtrees: RenderSubtree[];
  cssSources: SelectorSourceInput[];
}): ReachabilitySummary {
  const knownCssFilePaths = new Set(
    input.cssSources
      .map((cssSource) => normalizeProjectPath(cssSource.filePath))
      .filter(Boolean) as string[],
  );

  return {
    stylesheets: input.cssSources.map((cssSource) =>
      buildStylesheetReachabilityRecord({
        cssSource,
        moduleGraph: input.moduleGraph,
        renderGraph: input.renderGraph,
        renderSubtrees: input.renderSubtrees,
        knownCssFilePaths,
      }),
    ),
  };
}

function buildStylesheetReachabilityRecord(input: {
  cssSource: SelectorSourceInput;
  moduleGraph: ModuleGraph;
  renderGraph: RenderGraph;
  renderSubtrees: RenderSubtree[];
  knownCssFilePaths: Set<string>;
}): StylesheetReachabilityRecord {
  const cssFilePath = normalizeProjectPath(input.cssSource.filePath);
  if (!cssFilePath) {
    return {
      cssFilePath: input.cssSource.filePath,
      availability: "unknown",
      contexts: [],
      reasons: [
        "stylesheet source does not have a file path, so reachability cannot be determined",
      ],
    };
  }

  const directlyImportingSourceFilePaths: string[] = [];
  for (const moduleNode of input.moduleGraph.modulesById.values()) {
    if (moduleNode.kind !== "source") {
      continue;
    }

    const importsCssSource = moduleNode.imports.some((importRecord) => {
      if (importRecord.importKind !== "css") {
        return false;
      }

      return (
        resolveCssImportPath({
          fromFilePath: moduleNode.filePath,
          specifier: importRecord.specifier,
          knownCssFilePaths: input.knownCssFilePaths,
        }) === cssFilePath
      );
    });

    if (importsCssSource) {
      directlyImportingSourceFilePaths.push(moduleNode.filePath.replace(/\\/g, "/"));
    }
  }

  if (directlyImportingSourceFilePaths.length === 0) {
    return {
      cssFilePath: input.cssSource.filePath,
      availability: "unavailable",
      contexts: [],
      reasons: ["no analyzed source file directly imports this stylesheet"],
    };
  }

  const sortedImportingSourceFilePaths = directlyImportingSourceFilePaths.sort((left, right) =>
    left.localeCompare(right),
  );
  const contextRecords = buildContextRecords({
    importingSourceFilePaths: sortedImportingSourceFilePaths,
    renderGraph: input.renderGraph,
    renderSubtrees: input.renderSubtrees,
  });

  return {
    cssFilePath: input.cssSource.filePath,
    availability: contextRecords.some((context) => context.availability === "definite")
      ? "definite"
      : "possible",
    contexts: contextRecords,
    reasons: [
      `stylesheet is directly imported by ${sortedImportingSourceFilePaths.length} analyzed source file${sortedImportingSourceFilePaths.length === 1 ? "" : "s"}`,
      `reachability is attached to ${contextRecords.length} explicit render context${contextRecords.length === 1 ? "" : "s"}`,
    ],
  };
}

function buildContextRecords(input: {
  importingSourceFilePaths: string[];
  renderGraph: RenderGraph;
  renderSubtrees: RenderSubtree[];
}): StylesheetReachabilityContextRecord[] {
  const contextRecordsByKey = new Map<string, StylesheetReachabilityContextRecord>();
  const renderRegions = collectRenderRegionsFromSubtrees(input.renderSubtrees);
  const renderRegionsByComponentKey = new Map<string, RenderRegion[]>();
  const renderSubtreesByComponentKey = new Map<string, RenderSubtree>();
  const renderGraphNodesByKey = new Map(
    input.renderGraph.nodes.map((node) => [
      createComponentKey(node.filePath, node.componentName),
      node,
    ]),
  );
  const directImportingSourceFilePathSet = new Set(input.importingSourceFilePaths);

  for (const renderRegion of renderRegions) {
    if (!renderRegion.componentName) {
      continue;
    }

    const componentKey = createComponentKey(renderRegion.filePath, renderRegion.componentName);
    renderRegionsByComponentKey.set(componentKey, [
      ...(renderRegionsByComponentKey.get(componentKey) ?? []),
      renderRegion,
    ]);
  }

  for (const renderSubtree of input.renderSubtrees) {
    if (!renderSubtree.componentName) {
      continue;
    }

    renderSubtreesByComponentKey.set(
      createComponentKey(
        normalizeProjectPath(renderSubtree.sourceAnchor.filePath) ??
          renderSubtree.sourceAnchor.filePath,
        renderSubtree.componentName,
      ),
      renderSubtree,
    );
  }

  for (const filePath of input.importingSourceFilePaths) {
    addContextRecord(contextRecordsByKey, {
      context: {
        kind: "source-file",
        filePath,
      },
      availability: "definite",
      reasons: ["source file directly imports this stylesheet"],
      derivations: [{ kind: "source-file-direct-import" }],
    });
  }

  const outgoingEdgesByComponentKey = new Map<string, typeof input.renderGraph.edges>();
  const incomingEdgesByComponentKey = new Map<string, typeof input.renderGraph.edges>();
  for (const edge of input.renderGraph.edges) {
    if (edge.resolution !== "resolved" || !edge.toFilePath) {
      continue;
    }

    const fromKey = createComponentKey(edge.fromFilePath, edge.fromComponentName);
    const toKey = createComponentKey(edge.toFilePath, edge.toComponentName);
    outgoingEdgesByComponentKey.set(fromKey, [
      ...(outgoingEdgesByComponentKey.get(fromKey) ?? []),
      edge,
    ]);
    incomingEdgesByComponentKey.set(toKey, [
      ...(incomingEdgesByComponentKey.get(toKey) ?? []),
      edge,
    ]);
  }

  const componentAvailabilityByKey = computeComponentAvailability({
    renderGraphNodesByKey,
    incomingEdgesByComponentKey,
    outgoingEdgesByComponentKey,
    directImportingSourceFilePathSet,
  });

  const importingComponentKeys = input.renderGraph.nodes
    .filter((node) =>
      input.importingSourceFilePaths.includes(normalizeProjectPath(node.filePath) ?? node.filePath),
    )
    .map((node) => createComponentKey(node.filePath, node.componentName))
    .sort((left, right) => left.localeCompare(right));

  for (const componentKey of importingComponentKeys) {
    const node = renderGraphNodesByKey.get(componentKey);
    if (!node) {
      continue;
    }

    addContextRecord(contextRecordsByKey, {
      context: {
        kind: "component",
        filePath: normalizeProjectPath(node.filePath) ?? node.filePath,
        componentName: node.componentName,
      },
      availability: "definite",
      reasons: ["component is declared in a source file that directly imports this stylesheet"],
      derivations: [{ kind: "whole-component-direct-import" }],
    });
  }

  for (const [componentKey, availabilityRecord] of componentAvailabilityByKey.entries()) {
    if (availabilityRecord.availability === "unavailable") {
      continue;
    }

    const node = renderGraphNodesByKey.get(componentKey);
    if (!node) {
      continue;
    }

    const wholeComponentRegionAvailability = resolveWholeComponentRegionAvailability({
      componentKey,
      filePath: normalizeProjectPath(node.filePath) ?? node.filePath,
      directImportingSourceFilePathSet,
      incomingEdges: [...(incomingEdgesByComponentKey.get(componentKey) ?? [])].sort(compareEdges),
      outgoingEdges: [...(outgoingEdgesByComponentKey.get(componentKey) ?? [])].sort(compareEdges),
      componentAvailabilityByKey,
    });

    if (wholeComponentRegionAvailability && !importingComponentKeys.includes(componentKey)) {
      addContextRecord(contextRecordsByKey, {
        context: {
          kind: "component",
          filePath: normalizeProjectPath(node.filePath) ?? node.filePath,
          componentName: node.componentName,
        },
        availability: wholeComponentRegionAvailability.availability,
        reasons: wholeComponentRegionAvailability.reasons,
        derivations: wholeComponentRegionAvailability.derivations,
      });
    }

    if (wholeComponentRegionAvailability) {
      addRenderSubtreeRootContexts({
        contextRecordsByKey,
        renderSubtrees: input.renderSubtrees,
        availability: wholeComponentRegionAvailability.availability,
        reason:
          wholeComponentRegionAvailability.reasons[0] ??
          "render subtree root inherits component stylesheet availability",
        derivations: wholeComponentRegionAvailability.derivations,
        predicate: (subtree) =>
          (normalizeProjectPath(subtree.sourceAnchor.filePath) ?? subtree.sourceAnchor.filePath) ===
            (normalizeProjectPath(node.filePath) ?? node.filePath) &&
          subtree.componentName === node.componentName,
      });
      addRenderRegionContexts({
        contextRecordsByKey,
        renderRegions: renderRegionsByComponentKey.get(componentKey) ?? [],
        availability: wholeComponentRegionAvailability.availability,
        reasons: wholeComponentRegionAvailability.reasons,
        derivations: wholeComponentRegionAvailability.derivations,
        predicate: () => true,
      });
    }

    addPlacedChildRenderRegionContexts({
      contextRecordsByKey,
      renderSubtree: renderSubtreesByComponentKey.get(componentKey),
      renderRegions: renderRegionsByComponentKey.get(componentKey) ?? [],
      outgoingEdges: [...(outgoingEdgesByComponentKey.get(componentKey) ?? [])].sort(compareEdges),
      componentAvailabilityByKey,
    });
  }

  return [...contextRecordsByKey.values()].sort(compareContextRecords);
}

function resolveWholeComponentRegionAvailability(input: {
  componentKey: string;
  filePath: string;
  directImportingSourceFilePathSet: Set<string>;
  incomingEdges: import("../render-graph/types.js").RenderGraphEdge[];
  outgoingEdges: import("../render-graph/types.js").RenderGraphEdge[];
  componentAvailabilityByKey: Map<
    string,
    {
      availability: StylesheetReachabilityContextRecord["availability"];
      reasons: string[];
      derivations: ReachabilityDerivation[];
    }
  >;
}):
  | {
      availability: StylesheetReachabilityContextRecord["availability"];
      reasons: string[];
      derivations: ReachabilityDerivation[];
    }
  | undefined {
  if (input.directImportingSourceFilePathSet.has(input.filePath)) {
    return {
      availability: "definite",
      reasons: ["component is declared in a source file that directly imports this stylesheet"],
      derivations: [{ kind: "whole-component-direct-import" }],
    };
  }

  const definiteChildEdge = input.outgoingEdges.find((edge) => {
    const childAvailability = input.componentAvailabilityByKey.get(
      createComponentKey(edge.toFilePath ?? "", edge.toComponentName),
    );
    return childAvailability?.availability === "definite" && edge.renderPath === "definite";
  });
  if (definiteChildEdge) {
    return {
      availability: "definite",
      reasons: [
        `component can render ${definiteChildEdge.toComponentName} from ${normalizeProjectPath(definiteChildEdge.toFilePath) ?? definiteChildEdge.toFilePath}, which has definite stylesheet availability`,
      ],
      derivations: [
        {
          kind: "whole-component-child-availability",
          toComponentName: definiteChildEdge.toComponentName,
          toFilePath: definiteChildEdge.toFilePath,
        },
      ],
    };
  }

  const availableIncomingEdges = input.incomingEdges.filter((edge) => {
    const parentAvailability = input.componentAvailabilityByKey.get(
      createComponentKey(edge.fromFilePath, edge.fromComponentName),
    );
    return (
      parentAvailability?.availability === "definite" ||
      parentAvailability?.availability === "possible"
    );
  });
  if (availableIncomingEdges.length === 0) {
    return undefined;
  }

  const allParentsDefinite = availableIncomingEdges.every((edge) => {
    const parentAvailability = input.componentAvailabilityByKey.get(
      createComponentKey(edge.fromFilePath, edge.fromComponentName),
    );
    return parentAvailability?.availability === "definite" && edge.renderPath === "definite";
  });
  if (allParentsDefinite) {
    return {
      availability: "definite",
      reasons: ["all known renderers of this component have definite stylesheet availability"],
      derivations: [{ kind: "whole-component-all-known-renderers-definite" }],
    };
  }

  if (availableIncomingEdges.some((edge) => edge.renderPath === "definite")) {
    return {
      availability: "possible",
      reasons: ["at least one known renderer of this component has stylesheet availability"],
      derivations: [{ kind: "whole-component-at-least-one-renderer" }],
    };
  }

  return {
    availability: "possible",
    reasons: [
      "this component is only rendered on possible paths beneath a renderer with stylesheet availability",
    ],
    derivations: [{ kind: "whole-component-only-possible-renderers" }],
  };
}

function addPlacedChildRenderRegionContexts(input: {
  contextRecordsByKey: Map<string, StylesheetReachabilityContextRecord>;
  renderSubtree?: RenderSubtree;
  renderRegions: RenderRegion[];
  outgoingEdges: import("../render-graph/types.js").RenderGraphEdge[];
  componentAvailabilityByKey: Map<
    string,
    {
      availability: StylesheetReachabilityContextRecord["availability"];
      reasons: string[];
      derivations: ReachabilityDerivation[];
    }
  >;
}): void {
  for (const edge of input.outgoingEdges) {
    const childAvailability = input.componentAvailabilityByKey.get(
      createComponentKey(edge.toFilePath ?? "", edge.toComponentName),
    );
    if (
      !childAvailability ||
      (childAvailability.availability !== "definite" &&
        childAvailability.availability !== "possible")
    ) {
      continue;
    }

    const availability =
      childAvailability.availability === "definite" && edge.renderPath === "definite"
        ? "definite"
        : "possible";
    const reasons =
      availability === "definite"
        ? [
            `region can render ${edge.toComponentName} from ${normalizeProjectPath(edge.toFilePath) ?? edge.toFilePath}, which has definite stylesheet availability`,
          ]
        : [
            `region can render ${edge.toComponentName} from ${normalizeProjectPath(edge.toFilePath) ?? edge.toFilePath}, which has stylesheet availability`,
          ];
    const derivations: ReachabilityDerivation[] = [
      {
        kind: "placement-derived-region",
        toComponentName: edge.toComponentName,
        toFilePath: edge.toFilePath,
        renderPath: edge.renderPath,
      },
    ];

    for (const renderRegion of findContainingRenderRegionsForEdge({
      renderSubtree: input.renderSubtree,
      renderRegions: input.renderRegions,
      sourceAnchor: edge.sourceAnchor,
    })) {
      addContextRecord(input.contextRecordsByKey, {
        context: {
          kind: "render-region",
          filePath: renderRegion.filePath,
          componentName: renderRegion.componentName,
          regionKind: renderRegion.kind,
          path: renderRegion.path,
          sourceAnchor: {
            startLine: renderRegion.sourceAnchor.startLine,
            startColumn: renderRegion.sourceAnchor.startColumn,
            endLine: renderRegion.sourceAnchor.endLine,
            endColumn: renderRegion.sourceAnchor.endColumn,
          },
        },
        availability,
        reasons,
        derivations,
      });
    }
  }
}

function findContainingRenderRegionsForEdge(input: {
  renderSubtree?: RenderSubtree;
  renderRegions: RenderRegion[];
  sourceAnchor: import("../../types/core.js").SourceAnchor;
}): RenderRegion[] {
  if (!input.renderSubtree) {
    return [];
  }

  const matchingPathKeys = new Set(
    resolvePlacementRegionPaths({
      node: input.renderSubtree.root,
      sourceAnchor: input.sourceAnchor,
      path: [{ kind: "root" }],
    }).map((path) => serializeRegionPath(path)),
  );

  return input.renderRegions.filter(
    (renderRegion) =>
      renderRegion.kind !== "subtree-root" &&
      matchingPathKeys.has(serializeRegionPath(renderRegion.path)),
  );
}

function resolvePlacementRegionPaths(input: {
  node: import("../render-ir/types.js").RenderNode;
  sourceAnchor: import("../../types/core.js").SourceAnchor;
  path: RenderRegion["path"];
}): RenderRegion["path"][] {
  if (input.node.kind === "conditional") {
    if (
      normalizeProjectPath(input.node.sourceAnchor.filePath) ===
        normalizeProjectPath(input.sourceAnchor.filePath) &&
      !sourceAnchorContains(input.node.sourceAnchor, input.sourceAnchor)
    ) {
      return [];
    }

    return [
      ...resolveConditionalBranchPlacementPaths({
        branch: "when-true",
        branchNode: input.node.whenTrue,
        siblingBranchNode: input.node.whenFalse,
        sourceAnchor: input.sourceAnchor,
        path: input.path,
      }),
      ...resolveConditionalBranchPlacementPaths({
        branch: "when-false",
        branchNode: input.node.whenFalse,
        siblingBranchNode: input.node.whenTrue,
        sourceAnchor: input.sourceAnchor,
        path: input.path,
      }),
    ];
  }

  if (input.node.kind === "repeated-region") {
    if (
      normalizeProjectPath(input.node.sourceAnchor.filePath) ===
        normalizeProjectPath(input.sourceAnchor.filePath) &&
      !sourceAnchorContains(input.node.sourceAnchor, input.sourceAnchor)
    ) {
      return [];
    }

    const templatePath: RenderRegion["path"] = [...input.path, { kind: "repeated-template" }];
    return [
      templatePath,
      ...resolvePlacementRegionPaths({
        node: input.node.template,
        sourceAnchor: input.sourceAnchor,
        path: templatePath,
      }),
    ];
  }

  if (input.node.kind === "element" || input.node.kind === "fragment") {
    return input.node.children.flatMap((child, childIndex) =>
      resolvePlacementRegionPaths({
        node: child,
        sourceAnchor: input.sourceAnchor,
        path: [...input.path, { kind: "fragment-child", childIndex }],
      }),
    );
  }

  return [];
}

function resolveConditionalBranchPlacementPaths(input: {
  branch: "when-true" | "when-false";
  branchNode: import("../render-ir/types.js").RenderNode;
  siblingBranchNode: import("../render-ir/types.js").RenderNode;
  sourceAnchor: import("../../types/core.js").SourceAnchor;
  path: RenderRegion["path"];
}): RenderRegion["path"][] {
  if (!isRenderNodePlacementCandidate(input.branchNode, input.sourceAnchor)) {
    return [];
  }

  const matchingBranchPath: RenderRegion["path"] = [
    ...input.path,
    { kind: "conditional-branch", branch: input.branch },
  ];

  const siblingMatches = isRenderNodePlacementCandidate(
    input.siblingBranchNode,
    input.sourceAnchor,
  );
  if (
    siblingMatches &&
    normalizeProjectPath(input.siblingBranchNode.sourceAnchor.filePath) ===
      normalizeProjectPath(input.sourceAnchor.filePath)
  ) {
    return [];
  }

  return [
    matchingBranchPath,
    ...resolvePlacementRegionPaths({
      node: input.branchNode,
      sourceAnchor: input.sourceAnchor,
      path: matchingBranchPath,
    }),
  ];
}

function isRenderNodePlacementCandidate(
  node: import("../render-ir/types.js").RenderNode,
  sourceAnchor: import("../../types/core.js").SourceAnchor,
): boolean {
  const normalizedNodeFilePath = normalizeProjectPath(node.sourceAnchor.filePath);
  const normalizedSourceFilePath = normalizeProjectPath(sourceAnchor.filePath);
  if (normalizedNodeFilePath !== normalizedSourceFilePath) {
    return true;
  }

  return sourceAnchorContains(node.sourceAnchor, sourceAnchor);
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

function computeComponentAvailability(input: {
  renderGraphNodesByKey: Map<string, import("../render-graph/types.js").RenderGraphNode>;
  incomingEdgesByComponentKey: Map<string, import("../render-graph/types.js").RenderGraphEdge[]>;
  outgoingEdgesByComponentKey: Map<string, import("../render-graph/types.js").RenderGraphEdge[]>;
  directImportingSourceFilePathSet: Set<string>;
}): Map<
  string,
  {
    availability: StylesheetReachabilityContextRecord["availability"];
    reasons: string[];
    derivations: ReachabilityDerivation[];
  }
> {
  const availabilityByComponentKey = new Map<
    string,
    {
      availability: StylesheetReachabilityContextRecord["availability"];
      reasons: string[];
      derivations: ReachabilityDerivation[];
    }
  >();

  const sortedComponentKeys = [...input.renderGraphNodesByKey.keys()].sort((left, right) =>
    left.localeCompare(right),
  );

  for (const componentKey of sortedComponentKeys) {
    const node = input.renderGraphNodesByKey.get(componentKey);
    if (!node) {
      continue;
    }

    if (
      input.directImportingSourceFilePathSet.has(
        normalizeProjectPath(node.filePath) ?? node.filePath,
      )
    ) {
      availabilityByComponentKey.set(componentKey, {
        availability: "definite",
        reasons: ["component is declared in a source file that directly imports this stylesheet"],
        derivations: [{ kind: "whole-component-direct-import" }],
      });
      continue;
    }

    availabilityByComponentKey.set(componentKey, {
      availability: "unavailable",
      reasons: [],
      derivations: [],
    });
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const componentKey of sortedComponentKeys) {
      const node = input.renderGraphNodesByKey.get(componentKey);
      if (!node) {
        continue;
      }

      const currentAvailabilityRecord = availabilityByComponentKey.get(componentKey);
      if (
        input.directImportingSourceFilePathSet.has(
          normalizeProjectPath(node.filePath) ?? node.filePath,
        ) &&
        currentAvailabilityRecord?.availability === "definite"
      ) {
        continue;
      }

      const nextAvailabilityRecord = evaluateComponentAvailability({
        componentKey,
        incomingEdges: [...(input.incomingEdgesByComponentKey.get(componentKey) ?? [])].sort(
          compareEdges,
        ),
        outgoingEdges: [...(input.outgoingEdgesByComponentKey.get(componentKey) ?? [])].sort(
          compareEdges,
        ),
        availabilityByComponentKey,
      });

      if (
        currentAvailabilityRecord?.availability !== nextAvailabilityRecord.availability ||
        !areReasonsEqual(
          currentAvailabilityRecord?.reasons ?? [],
          nextAvailabilityRecord.reasons,
        ) ||
        !areDerivationsEqual(
          currentAvailabilityRecord?.derivations ?? [],
          nextAvailabilityRecord.derivations,
        )
      ) {
        availabilityByComponentKey.set(componentKey, nextAvailabilityRecord);
        changed = true;
      }
    }
  }

  return availabilityByComponentKey;
}

function evaluateComponentAvailability(input: {
  componentKey: string;
  incomingEdges: import("../render-graph/types.js").RenderGraphEdge[];
  outgoingEdges: import("../render-graph/types.js").RenderGraphEdge[];
  availabilityByComponentKey: Map<
    string,
    {
      availability: StylesheetReachabilityContextRecord["availability"];
      reasons: string[];
      derivations: ReachabilityDerivation[];
    }
  >;
}): {
  availability: StylesheetReachabilityContextRecord["availability"];
  reasons: string[];
  derivations: ReachabilityDerivation[];
} {
  const definiteChildEdge = input.outgoingEdges.find((edge) => {
    const childAvailability = input.availabilityByComponentKey.get(
      createComponentKey(edge.toFilePath ?? "", edge.toComponentName),
    );
    return childAvailability?.availability === "definite" && edge.renderPath === "definite";
  });
  if (definiteChildEdge) {
    return {
      availability: "definite",
      reasons: [
        `component can render ${definiteChildEdge.toComponentName} from ${normalizeProjectPath(definiteChildEdge.toFilePath) ?? definiteChildEdge.toFilePath}, which has definite stylesheet availability`,
      ],
      derivations: [
        {
          kind: "whole-component-child-availability",
          toComponentName: definiteChildEdge.toComponentName,
          toFilePath: definiteChildEdge.toFilePath,
        },
      ],
    };
  }

  if (input.incomingEdges.length > 0) {
    const parentAvailabilities = input.incomingEdges.map((edge) => ({
      edge,
      availability: input.availabilityByComponentKey.get(
        createComponentKey(edge.fromFilePath, edge.fromComponentName),
      ),
    }));
    const allParentsDefinite =
      parentAvailabilities.length > 0 &&
      parentAvailabilities.every(
        ({ edge, availability }) =>
          availability?.availability === "definite" && edge.renderPath === "definite",
      );
    if (allParentsDefinite) {
      return {
        availability: "definite",
        reasons: ["all known renderers of this component have definite stylesheet availability"],
        derivations: [{ kind: "whole-component-all-known-renderers-definite" }],
      };
    }
  }

  const availableChildEdge = input.outgoingEdges.find((edge) => {
    const childAvailability = input.availabilityByComponentKey.get(
      createComponentKey(edge.toFilePath ?? "", edge.toComponentName),
    );
    return (
      childAvailability?.availability === "definite" ||
      childAvailability?.availability === "possible"
    );
  });
  if (availableChildEdge) {
    return {
      availability: "possible",
      reasons: [
        `component can render ${availableChildEdge.toComponentName} from ${normalizeProjectPath(availableChildEdge.toFilePath) ?? availableChildEdge.toFilePath}, which has stylesheet availability`,
      ],
      derivations: [
        {
          kind: "whole-component-child-availability",
          toComponentName: availableChildEdge.toComponentName,
          toFilePath: availableChildEdge.toFilePath,
        },
      ],
    };
  }

  const availableParentEdges = input.incomingEdges.filter((edge) => {
    const parentAvailability = input.availabilityByComponentKey.get(
      createComponentKey(edge.fromFilePath, edge.fromComponentName),
    );
    return (
      parentAvailability?.availability === "definite" ||
      parentAvailability?.availability === "possible"
    );
  });
  if (availableParentEdges.length > 0) {
    const definitePathParentEdges = availableParentEdges.filter(
      (edge) => edge.renderPath === "definite",
    );
    if (definitePathParentEdges.length > 0) {
      return {
        availability: "possible",
        reasons: ["at least one known renderer of this component has stylesheet availability"],
        derivations: [{ kind: "whole-component-at-least-one-renderer" }],
      };
    }

    return {
      availability: "possible",
      reasons: [
        "this component is only rendered on possible paths beneath a renderer with stylesheet availability",
      ],
      derivations: [{ kind: "whole-component-only-possible-renderers" }],
    };
  }

  return {
    availability: "unavailable",
    reasons: [],
    derivations: [],
  };
}

function areReasonsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((reason, index) => reason === right[index]);
}

function areDerivationsEqual(
  left: ReachabilityDerivation[],
  right: ReachabilityDerivation[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort(compareDerivations);
  const sortedRight = [...right].sort(compareDerivations);
  return sortedLeft.every(
    (derivation, index) =>
      serializeDerivation(derivation) === serializeDerivation(sortedRight[index]),
  );
}

function addRenderSubtreeRootContexts(input: {
  contextRecordsByKey: Map<string, StylesheetReachabilityContextRecord>;
  renderSubtrees: RenderSubtree[];
  availability: StylesheetReachabilityContextRecord["availability"];
  reason: string;
  derivations: ReachabilityDerivation[];
  predicate: (subtree: RenderSubtree) => boolean;
}): void {
  for (const subtree of input.renderSubtrees.filter(input.predicate)) {
    addContextRecord(input.contextRecordsByKey, {
      context: {
        kind: "render-subtree-root",
        filePath:
          normalizeProjectPath(subtree.sourceAnchor.filePath) ?? subtree.sourceAnchor.filePath,
        componentName: subtree.componentName,
        rootAnchor: {
          startLine: subtree.root.sourceAnchor.startLine,
          startColumn: subtree.root.sourceAnchor.startColumn,
          endLine: subtree.root.sourceAnchor.endLine,
          endColumn: subtree.root.sourceAnchor.endColumn,
        },
      },
      availability: input.availability,
      reasons: [input.reason],
      derivations: [...input.derivations],
    });
  }
}

function addRenderRegionContexts(input: {
  contextRecordsByKey: Map<string, StylesheetReachabilityContextRecord>;
  renderRegions: RenderRegion[];
  availability: StylesheetReachabilityContextRecord["availability"];
  reasons: string[];
  derivations: ReachabilityDerivation[];
  predicate: (region: RenderRegion) => boolean;
}): void {
  for (const region of input.renderRegions.filter(input.predicate)) {
    if (region.kind === "subtree-root") {
      continue;
    }

    addContextRecord(input.contextRecordsByKey, {
      context: {
        kind: "render-region",
        filePath: region.filePath,
        componentName: region.componentName,
        regionKind: region.kind,
        path: region.path,
        sourceAnchor: {
          startLine: region.sourceAnchor.startLine,
          startColumn: region.sourceAnchor.startColumn,
          endLine: region.sourceAnchor.endLine,
          endColumn: region.sourceAnchor.endColumn,
        },
      },
      availability: input.availability,
      reasons: [...input.reasons],
      derivations: [...input.derivations],
    });
  }
}

function addContextRecord(
  contextRecordsByKey: Map<string, StylesheetReachabilityContextRecord>,
  contextRecord: StylesheetReachabilityContextRecord,
): void {
  const contextKey = serializeContextKey(contextRecord);
  const existingContextRecord = contextRecordsByKey.get(contextKey);
  if (!existingContextRecord) {
    contextRecordsByKey.set(contextKey, {
      ...contextRecord,
      reasons: [...contextRecord.reasons].sort((left, right) => left.localeCompare(right)),
      derivations: [...contextRecord.derivations].sort(compareDerivations),
    });
    return;
  }

  const mergedReasons = new Set([...existingContextRecord.reasons, ...contextRecord.reasons]);
  const derivationsByKey = new Map<string, ReachabilityDerivation>();
  for (const derivation of [...existingContextRecord.derivations, ...contextRecord.derivations]) {
    derivationsByKey.set(serializeDerivation(derivation), derivation);
  }
  contextRecordsByKey.set(contextKey, {
    ...existingContextRecord,
    availability: mergeAvailability(existingContextRecord.availability, contextRecord.availability),
    reasons: [...mergedReasons].sort((left, right) => left.localeCompare(right)),
    derivations: [...derivationsByKey.values()].sort(compareDerivations),
  });
}

function mergeAvailability(
  left: StylesheetReachabilityContextRecord["availability"],
  right: StylesheetReachabilityContextRecord["availability"],
): StylesheetReachabilityContextRecord["availability"] {
  const order: Record<StylesheetReachabilityContextRecord["availability"], number> = {
    definite: 3,
    possible: 2,
    unknown: 1,
    unavailable: 0,
  };

  return order[left] >= order[right] ? left : right;
}

function serializeContextKey(contextRecord: StylesheetReachabilityContextRecord): string {
  if (contextRecord.context.kind === "source-file") {
    return `source-file:${contextRecord.context.filePath}`;
  }

  if (contextRecord.context.kind === "component") {
    return `component:${contextRecord.context.filePath}:${contextRecord.context.componentName}`;
  }

  if (contextRecord.context.kind === "render-region") {
    return [
      "render-region",
      contextRecord.context.filePath,
      contextRecord.context.componentName ?? "",
      contextRecord.context.regionKind,
      serializeRegionPath(contextRecord.context.path),
      contextRecord.context.sourceAnchor.startLine,
      contextRecord.context.sourceAnchor.startColumn,
      contextRecord.context.sourceAnchor.endLine ?? "",
      contextRecord.context.sourceAnchor.endColumn ?? "",
    ].join(":");
  }

  return [
    "render-subtree-root",
    contextRecord.context.filePath,
    contextRecord.context.componentName ?? "",
    contextRecord.context.rootAnchor.startLine,
    contextRecord.context.rootAnchor.startColumn,
    contextRecord.context.rootAnchor.endLine ?? "",
    contextRecord.context.rootAnchor.endColumn ?? "",
  ].join(":");
}

function compareDerivations(left: ReachabilityDerivation, right: ReachabilityDerivation): number {
  return serializeDerivation(left).localeCompare(serializeDerivation(right));
}

function serializeDerivation(derivation: ReachabilityDerivation): string {
  switch (derivation.kind) {
    case "source-file-direct-import":
    case "whole-component-direct-import":
    case "whole-component-all-known-renderers-definite":
    case "whole-component-at-least-one-renderer":
    case "whole-component-only-possible-renderers":
      return derivation.kind;
    case "whole-component-child-availability":
      return [derivation.kind, derivation.toComponentName, derivation.toFilePath ?? ""].join(":");
    case "placement-derived-region":
      return [
        derivation.kind,
        derivation.toComponentName,
        derivation.toFilePath ?? "",
        derivation.renderPath,
      ].join(":");
  }
}

function createComponentKey(filePath: string, componentName: string): string {
  return `${normalizeProjectPath(filePath) ?? filePath}::${componentName}`;
}

function compareContextRecords(
  left: StylesheetReachabilityContextRecord,
  right: StylesheetReachabilityContextRecord,
): number {
  if (left.context.kind !== right.context.kind) {
    return left.context.kind.localeCompare(right.context.kind);
  }

  if (left.context.kind === "source-file" && right.context.kind === "source-file") {
    return left.context.filePath.localeCompare(right.context.filePath);
  }

  if (left.context.kind === "component" && right.context.kind === "component") {
    return (
      left.context.filePath.localeCompare(right.context.filePath) ||
      left.context.componentName.localeCompare(right.context.componentName)
    );
  }

  if (left.context.kind === "render-subtree-root" && right.context.kind === "render-subtree-root") {
    return (
      left.context.filePath.localeCompare(right.context.filePath) ||
      (left.context.componentName ?? "").localeCompare(right.context.componentName ?? "") ||
      left.context.rootAnchor.startLine - right.context.rootAnchor.startLine ||
      left.context.rootAnchor.startColumn - right.context.rootAnchor.startColumn ||
      (left.context.rootAnchor.endLine ?? 0) - (right.context.rootAnchor.endLine ?? 0) ||
      (left.context.rootAnchor.endColumn ?? 0) - (right.context.rootAnchor.endColumn ?? 0)
    );
  }

  if (left.context.kind === "render-region" && right.context.kind === "render-region") {
    return (
      left.context.filePath.localeCompare(right.context.filePath) ||
      (left.context.componentName ?? "").localeCompare(right.context.componentName ?? "") ||
      left.context.regionKind.localeCompare(right.context.regionKind) ||
      serializeRegionPath(left.context.path).localeCompare(
        serializeRegionPath(right.context.path),
      ) ||
      left.context.sourceAnchor.startLine - right.context.sourceAnchor.startLine ||
      left.context.sourceAnchor.startColumn - right.context.sourceAnchor.startColumn ||
      (left.context.sourceAnchor.endLine ?? 0) - (right.context.sourceAnchor.endLine ?? 0) ||
      (left.context.sourceAnchor.endColumn ?? 0) - (right.context.sourceAnchor.endColumn ?? 0)
    );
  }

  return 0;
}

function serializeRegionPath(path: RenderRegion["path"]): string {
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

function compareEdges(
  left: import("../render-graph/types.js").RenderGraphEdge,
  right: import("../render-graph/types.js").RenderGraphEdge,
): number {
  return (
    left.fromFilePath.localeCompare(right.fromFilePath) ||
    left.fromComponentName.localeCompare(right.fromComponentName) ||
    left.toComponentName.localeCompare(right.toComponentName) ||
    (left.toFilePath ?? "").localeCompare(right.toFilePath ?? "")
  );
}

function resolveCssImportPath(input: {
  fromFilePath: string;
  specifier: string;
  knownCssFilePaths: Set<string>;
}): string | undefined {
  const normalizedSpecifier = normalizeProjectPath(input.specifier);
  const normalizedFromFilePath = normalizeProjectPath(input.fromFilePath);
  if (!normalizedSpecifier || !normalizedFromFilePath) {
    return undefined;
  }

  if (!normalizedSpecifier.endsWith(".css")) {
    return undefined;
  }

  if (!normalizedSpecifier.startsWith(".")) {
    return undefined;
  }

  const fromSegments = normalizedFromFilePath.split("/");
  fromSegments.pop();
  const specifierSegments = normalizedSpecifier.split("/").filter((segment) => segment.length > 0);
  const candidatePath = normalizeSegments([...fromSegments, ...specifierSegments]);
  return input.knownCssFilePaths.has(candidatePath) ? candidatePath : undefined;
}

function normalizeSegments(segments: string[]): string {
  const normalized: string[] = [];
  for (const segment of segments) {
    if (segment === ".") {
      continue;
    }

    if (segment === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized.join("/");
}

function normalizeProjectPath(filePath: string | undefined): string | undefined {
  return filePath?.replace(/\\/g, "/");
}
