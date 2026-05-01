import {
  renderedComponentBoundaryId,
  renderedComponentId,
  renderedElementId,
  renderPathId,
  renderRegionId,
} from "../ids.js";
import type {
  RenderGraphProjection,
  RenderPath,
  RenderPathSegment,
  RenderRegion,
  RenderStructureDiagnostic,
  RenderStructureInput,
  RenderedComponent,
  RenderedComponentBoundary,
  RenderedElement,
} from "../types.js";

type NativeRenderStructureProjection = {
  components: RenderedComponent[];
  componentBoundaries: RenderedComponentBoundary[];
  elements: RenderedElement[];
  emissionSites: [];
  renderPaths: RenderPath[];
  placementConditions: [];
  renderRegions: RenderRegion[];
  renderGraph: RenderGraphProjection;
  diagnostics: RenderStructureDiagnostic[];
};

export function buildNativeRenderStructure(
  input: RenderStructureInput,
): NativeRenderStructureProjection {
  const components: RenderedComponent[] = [];
  const componentBoundaries: RenderedComponentBoundary[] = [];
  const elements: RenderedElement[] = [];
  const renderPaths: RenderPath[] = [];
  const renderRegions: RenderRegion[] = [];

  const renderSitesById = new Map(
    input.graph.nodes.renderSites.map((site) => [site.id, site] as const),
  );
  const templatesByRenderSiteId = buildTemplatesByRenderSiteId(input);
  const childRenderSitesByParentRenderSiteId = buildChildRenderSitesByParentRenderSiteId(input);
  const rootRenderSitesByComponentNodeId = buildRootRenderSitesByComponentNodeId(input);
  const elementIdCounts = new Map<string, number>();
  const elementsById = new Map<string, RenderedElement>();

  for (const componentNode of [...input.graph.nodes.components].sort(compareComponentNodes)) {
    const boundaryId = renderedComponentBoundaryId({
      boundaryKind: "component-root",
      key: componentNode.componentKey,
    });
    const componentId = renderedComponentId(componentNode.componentKey);
    const declarationLocation = normalizeAnchor(componentNode.location);
    const filePath = normalizeProjectPath(componentNode.filePath);
    const boundaryPathSegments: RenderPathSegment[] = [
      {
        kind: "component-root",
        componentNodeId: componentNode.id,
        location: declarationLocation,
      },
    ];
    const boundaryRenderPathId = renderPathId({
      terminalKind: "component-boundary",
      terminalId: boundaryId,
    });
    const boundaryRenderPath: RenderPath = {
      id: boundaryRenderPathId,
      rootComponentNodeId: componentNode.id,
      terminalKind: "component-boundary",
      terminalId: boundaryId,
      segments: boundaryPathSegments,
      placementConditionIds: [],
      certainty: "definite",
      traces: [],
    };
    const rootElementIds: string[] = [];

    components.push({
      id: componentId,
      componentNodeId: componentNode.id,
      componentKey: componentNode.componentKey,
      componentName: componentNode.componentName,
      filePath,
      exported: componentNode.exported,
      declarationLocation,
      rootBoundaryIds: [boundaryId],
      provenance: [
        {
          stage: "render-structure",
          filePath,
          anchor: declarationLocation,
          upstreamId: componentNode.id,
          summary: "Derived rendered component from fact graph component node",
        },
      ],
      traces: [],
    });

    componentBoundaries.push({
      id: boundaryId,
      boundaryKind: "component-root",
      componentNodeId: componentNode.id,
      componentKey: componentNode.componentKey,
      componentName: componentNode.componentName,
      filePath,
      declarationLocation,
      childBoundaryIds: [],
      rootElementIds,
      renderPathId: boundaryRenderPath.id,
      placementConditionIds: [],
      expansion: { status: "root" },
      traces: [],
    });

    renderPaths.push(boundaryRenderPath);

    const rootRenderSites = rootRenderSitesByComponentNodeId.get(componentNode.id) ?? [];
    for (const [rootIndex, rootRenderSiteId] of rootRenderSites.entries()) {
      const rootRenderSite = renderSitesById.get(rootRenderSiteId);
      if (!rootRenderSite) {
        continue;
      }
      expandIntrinsicElementsForRenderSite({
        input,
        componentNodeId: componentNode.id,
        boundaryId,
        renderSite: rootRenderSite,
        childIndex: rootIndex,
        parentElementId: undefined,
        basePathSegments: boundaryPathSegments,
        templatesByRenderSiteId,
        childRenderSitesByParentRenderSiteId,
        elements,
        elementsById,
        elementIdCounts,
        renderPaths,
        rootElementIds,
      });
    }

    renderRegions.push({
      id: renderRegionId({
        regionKind: "component-root",
        key: componentNode.componentKey,
      }),
      regionKind: "component-root",
      boundaryId,
      componentNodeId: componentNode.id,
      renderPathId: boundaryRenderPath.id,
      sourceLocation: declarationLocation,
      placementConditionIds: [],
      childElementIds: uniqueSorted(rootElementIds),
      childBoundaryIds: [],
    });
  }

  return {
    components,
    componentBoundaries,
    elements: elements.sort((left, right) => left.id.localeCompare(right.id)),
    emissionSites: [],
    renderPaths: renderPaths.sort((left, right) => left.id.localeCompare(right.id)),
    placementConditions: [],
    renderRegions,
    renderGraph: {
      nodes: components
        .map((component) => ({
          componentNodeId: component.componentNodeId,
          componentKey: component.componentKey,
          componentName: component.componentName,
          filePath: component.filePath,
          exported: component.exported,
          sourceLocation: component.declarationLocation,
        }))
        .sort(
          (left, right) =>
            [
              left.filePath.localeCompare(right.filePath),
              left.componentKey.localeCompare(right.componentKey),
              left.componentName.localeCompare(right.componentName),
              compareAnchors(left.sourceLocation, right.sourceLocation),
            ].find((value) => value !== 0) ?? 0,
        ),
      edges: [],
    },
    diagnostics: [],
  };
}

function expandIntrinsicElementsForRenderSite(input: {
  input: RenderStructureInput;
  componentNodeId: string;
  boundaryId: string;
  renderSite: RenderStructureInput["graph"]["nodes"]["renderSites"][number];
  childIndex: number;
  parentElementId: string | undefined;
  basePathSegments: RenderPathSegment[];
  templatesByRenderSiteId: Map<string, RenderStructureInput["graph"]["nodes"]["elementTemplates"]>;
  childRenderSitesByParentRenderSiteId: Map<string, string[]>;
  elements: RenderedElement[];
  elementsById: Map<string, RenderedElement>;
  elementIdCounts: Map<string, number>;
  renderPaths: RenderPath[];
  rootElementIds: string[];
}): void {
  const templates = input.templatesByRenderSiteId.get(input.renderSite.id) ?? [];
  const childRenderSiteIds =
    input.childRenderSitesByParentRenderSiteId.get(input.renderSite.id) ?? [];

  const intrinsicTemplates = templates.filter((template) => template.templateKind === "intrinsic");
  if (intrinsicTemplates.length > 0) {
    for (const [templateIndex, template] of intrinsicTemplates.entries()) {
      const location = normalizeAnchor(template.location);
      const id = createRenderedElementId({
        boundaryId: input.boundaryId,
        templateNodeId: template.id,
        tagName: template.name,
        counts: input.elementIdCounts,
      });
      const pathSegments: RenderPathSegment[] = [
        ...input.basePathSegments,
        { kind: "child-index", index: input.childIndex },
        { kind: "element", elementId: id, tagName: template.name, location },
      ];
      const pathId = renderPathId({
        terminalKind: "element",
        terminalId: id,
      });
      const element: RenderedElement = {
        id,
        tagName: template.name,
        elementTemplateNodeId: template.id,
        renderSiteNodeId: input.renderSite.id,
        sourceLocation: location,
        ...(input.parentElementId ? { parentElementId: input.parentElementId } : {}),
        parentBoundaryId: input.boundaryId,
        childElementIds: [],
        childBoundaryIds: [],
        emissionSiteIds: [],
        ...(template.emittingComponentNodeId
          ? { emittingComponentNodeId: template.emittingComponentNodeId }
          : input.renderSite.emittingComponentNodeId
            ? { emittingComponentNodeId: input.renderSite.emittingComponentNodeId }
            : {}),
        ...(template.placementComponentNodeId
          ? { placementComponentNodeId: template.placementComponentNodeId }
          : input.renderSite.placementComponentNodeId
            ? { placementComponentNodeId: input.renderSite.placementComponentNodeId }
            : {}),
        renderPathId: pathId,
        placementConditionIds: [],
        certainty: "definite",
        traces: [],
      };
      input.elements.push(element);
      input.elementsById.set(element.id, element);
      input.renderPaths.push({
        id: pathId,
        rootComponentNodeId: input.componentNodeId,
        terminalKind: "element",
        terminalId: id,
        segments: pathSegments,
        placementConditionIds: [],
        certainty: "definite",
        traces: [],
      });

      if (input.parentElementId) {
        const parentElement = input.elementsById.get(input.parentElementId);
        if (parentElement) {
          parentElement.childElementIds = uniqueSorted([
            ...parentElement.childElementIds,
            element.id,
          ]);
        }
      } else {
        input.rootElementIds.push(element.id);
      }

      for (const [childIndex, childRenderSiteId] of childRenderSiteIds.entries()) {
        const childRenderSite = input.input.graph.indexes.nodesById.get(childRenderSiteId);
        if (!childRenderSite || childRenderSite.kind !== "render-site") {
          continue;
        }
        expandIntrinsicElementsForRenderSite({
          ...input,
          renderSite: childRenderSite,
          childIndex,
          parentElementId: element.id,
          basePathSegments: pathSegments,
        });
      }

      // Multiple intrinsic templates for one render site are uncommon; preserve deterministic traversal.
      if (templateIndex < intrinsicTemplates.length - 1) {
        continue;
      }
    }
    return;
  }

  // Fragments and non-element render sites pass through and continue expansion for child sites.
  for (const [childIndex, childRenderSiteId] of childRenderSiteIds.entries()) {
    const childRenderSite = input.input.graph.indexes.nodesById.get(childRenderSiteId);
    if (!childRenderSite || childRenderSite.kind !== "render-site") {
      continue;
    }
    expandIntrinsicElementsForRenderSite({
      ...input,
      renderSite: childRenderSite,
      childIndex,
    });
  }
}

function buildTemplatesByRenderSiteId(
  input: RenderStructureInput,
): Map<string, RenderStructureInput["graph"]["nodes"]["elementTemplates"]> {
  const templatesByRenderSiteId = new Map<
    string,
    RenderStructureInput["graph"]["nodes"]["elementTemplates"]
  >();
  for (const template of input.graph.nodes.elementTemplates) {
    const existing = templatesByRenderSiteId.get(template.renderSiteNodeId) ?? [];
    existing.push(template);
    templatesByRenderSiteId.set(template.renderSiteNodeId, existing);
  }
  for (const [renderSiteId, templates] of templatesByRenderSiteId.entries()) {
    templatesByRenderSiteId.set(
      renderSiteId,
      [...templates].sort(
        (left, right) =>
          compareAnchors(left.location, right.location) ||
          left.templateKind.localeCompare(right.templateKind) ||
          left.id.localeCompare(right.id),
      ),
    );
  }
  return templatesByRenderSiteId;
}

function buildChildRenderSitesByParentRenderSiteId(
  input: RenderStructureInput,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const site of input.graph.nodes.renderSites) {
    if (!site.parentRenderSiteNodeId) {
      continue;
    }
    const existing = result.get(site.parentRenderSiteNodeId) ?? [];
    existing.push(site.id);
    result.set(site.parentRenderSiteNodeId, existing);
  }
  for (const [parentId, childIds] of result.entries()) {
    result.set(
      parentId,
      [...childIds].sort((leftId, rightId) => {
        const left = input.graph.indexes.nodesById.get(leftId);
        const right = input.graph.indexes.nodesById.get(rightId);
        if (!left || left.kind !== "render-site" || !right || right.kind !== "render-site") {
          return leftId.localeCompare(rightId);
        }
        return (
          compareAnchors(left.location, right.location) ||
          left.renderSiteKind.localeCompare(right.renderSiteKind) ||
          left.id.localeCompare(right.id)
        );
      }),
    );
  }
  return result;
}

function buildRootRenderSitesByComponentNodeId(input: RenderStructureInput): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const site of input.graph.nodes.renderSites) {
    if (
      site.renderSiteKind !== "component-root" ||
      !site.emittingComponentNodeId ||
      site.parentRenderSiteNodeId
    ) {
      continue;
    }
    const existing = result.get(site.emittingComponentNodeId) ?? [];
    existing.push(site.id);
    result.set(site.emittingComponentNodeId, existing);
  }
  for (const [componentNodeId, rootSiteIds] of result.entries()) {
    result.set(
      componentNodeId,
      [...rootSiteIds].sort((leftId, rightId) => {
        const left = input.graph.indexes.nodesById.get(leftId);
        const right = input.graph.indexes.nodesById.get(rightId);
        if (!left || left.kind !== "render-site" || !right || right.kind !== "render-site") {
          return leftId.localeCompare(rightId);
        }
        return compareAnchors(left.location, right.location) || left.id.localeCompare(right.id);
      }),
    );
  }
  return result;
}

function createRenderedElementId(input: {
  boundaryId: string;
  templateNodeId: string;
  tagName: string;
  counts: Map<string, number>;
}): string {
  const key = `${input.boundaryId}:${input.templateNodeId}`;
  const index = input.counts.get(key) ?? 0;
  input.counts.set(key, index + 1);
  return renderedElementId({
    key: key,
    tagName: input.tagName,
    index,
  });
}

function compareComponentNodes(
  left: RenderStructureInput["graph"]["nodes"]["components"][number],
  right: RenderStructureInput["graph"]["nodes"]["components"][number],
): number {
  return (
    left.filePath.localeCompare(right.filePath) ||
    left.componentKey.localeCompare(right.componentKey) ||
    left.componentName.localeCompare(right.componentName) ||
    compareAnchors(left.location, right.location)
  );
}

function compareAnchors(
  left: RenderStructureInput["graph"]["nodes"]["components"][number]["location"],
  right: RenderStructureInput["graph"]["nodes"]["components"][number]["location"],
): number {
  return (
    normalizeProjectPath(left.filePath).localeCompare(normalizeProjectPath(right.filePath)) ||
    left.startLine - right.startLine ||
    left.startColumn - right.startColumn ||
    (left.endLine ?? 0) - (right.endLine ?? 0) ||
    (left.endColumn ?? 0) - (right.endColumn ?? 0)
  );
}

function normalizeAnchor(
  anchor: RenderStructureInput["graph"]["nodes"]["components"][number]["location"],
): RenderStructureInput["graph"]["nodes"]["components"][number]["location"] {
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
