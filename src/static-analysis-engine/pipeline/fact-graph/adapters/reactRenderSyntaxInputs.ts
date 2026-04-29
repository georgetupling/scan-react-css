import type {
  ClassExpressionSiteNode,
  ComponentNode,
  ElementTemplateNode,
  FactGraph,
  RenderSiteNode,
} from "../types.js";

export type FactGraphReactRenderSyntaxInputs = {
  components: ComponentNode[];
  renderSites: RenderSiteNode[];
  elementTemplates: ElementTemplateNode[];
  classExpressionSites: ClassExpressionSiteNode[];
  renderSitesByComponentNodeId: Map<string, RenderSiteNode[]>;
  classExpressionSitesByComponentNodeId: Map<string, ClassExpressionSiteNode[]>;
  elementTemplatesByRenderSiteNodeId: Map<string, ElementTemplateNode[]>;
  classExpressionSitesByRenderSiteNodeId: Map<string, ClassExpressionSiteNode[]>;
};

export function graphToReactRenderSyntaxInputs(graph: FactGraph): FactGraphReactRenderSyntaxInputs {
  return {
    components: [...graph.nodes.components],
    renderSites: [...graph.nodes.renderSites],
    elementTemplates: [...graph.nodes.elementTemplates],
    classExpressionSites: [...graph.nodes.classExpressionSites],
    renderSitesByComponentNodeId: groupByOptional(
      graph.nodes.renderSites,
      (node) => node.emittingComponentNodeId,
    ),
    classExpressionSitesByComponentNodeId: groupByOptional(
      graph.nodes.classExpressionSites,
      (node) => node.emittingComponentNodeId,
    ),
    elementTemplatesByRenderSiteNodeId: groupBy(
      graph.nodes.elementTemplates,
      (node) => node.renderSiteNodeId,
    ),
    classExpressionSitesByRenderSiteNodeId: groupByOptional(
      graph.nodes.classExpressionSites,
      (node) => node.renderSiteNodeId,
    ),
  };
}

function groupBy<T extends { id: string }>(
  values: T[],
  getKey: (value: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    const existing = grouped.get(key) ?? [];
    existing.push(value);
    grouped.set(key, existing);
  }
  return sortGroupedValues(grouped);
}

function groupByOptional<T extends { id: string }>(
  values: T[],
  getKey: (value: T) => string | undefined,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    if (!key) {
      continue;
    }

    const existing = grouped.get(key) ?? [];
    existing.push(value);
    grouped.set(key, existing);
  }
  return sortGroupedValues(grouped);
}

function sortGroupedValues<T extends { id: string }>(grouped: Map<string, T[]>): Map<string, T[]> {
  return new Map(
    [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [
        key,
        [...values].sort((left, right) => left.id.localeCompare(right.id)),
      ]),
  );
}
