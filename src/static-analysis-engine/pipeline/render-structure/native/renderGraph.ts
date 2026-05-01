import type {
  RenderGraphProjectionEdge,
  RenderGraphProjectionNode,
  RenderStructureInput,
  RenderedComponent,
} from "../types.js";
import { compareAnchors } from "./common.js";

export function buildRenderGraphNodes(
  components: RenderedComponent[],
): RenderGraphProjectionNode[] {
  return components
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
    );
}

export function sortRenderGraphEdges(
  edges: RenderGraphProjectionEdge[],
): RenderGraphProjectionEdge[] {
  return [...edges].sort(
    (left, right) =>
      left.fromFilePath.localeCompare(right.fromFilePath) ||
      left.fromComponentKey.localeCompare(right.fromComponentKey) ||
      left.toComponentName.localeCompare(right.toComponentName) ||
      compareAnchors(left.sourceLocation, right.sourceLocation),
  );
}

export function buildRenderEdgesByFromComponentNodeId(
  input: RenderStructureInput,
): Map<string, RenderStructureInput["graph"]["edges"]["renders"]> {
  const map = new Map<string, RenderStructureInput["graph"]["edges"]["renders"]>();
  for (const edge of input.graph.edges.renders) {
    const existing = map.get(edge.from) ?? [];
    existing.push(edge);
    map.set(edge.from, existing);
  }
  return map;
}
