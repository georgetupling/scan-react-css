import type { RenderedElement, RenderStructureInput } from "../types.js";
import { compareAnchors } from "./common.js";

export function buildTemplatesByRenderSiteId(
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

export function buildChildRenderSitesByParentRenderSiteId(
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

export function buildRootRenderSitesByComponentNodeId(
  input: RenderStructureInput,
): Map<string, string[]> {
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

export function buildElementIdsByTemplateNodeId(
  elements: RenderedElement[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const element of elements) {
    if (!element.elementTemplateNodeId) {
      continue;
    }
    const existing = map.get(element.elementTemplateNodeId) ?? [];
    existing.push(element.id);
    map.set(element.elementTemplateNodeId, existing);
  }
  return map;
}

export function buildElementIdsByRenderSiteNodeId(
  elements: RenderedElement[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const element of elements) {
    if (!element.renderSiteNodeId) {
      continue;
    }
    const existing = map.get(element.renderSiteNodeId) ?? [];
    existing.push(element.id);
    map.set(element.renderSiteNodeId, existing);
  }
  return map;
}
