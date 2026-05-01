import type { EmissionSite, RenderModel, RenderedElement } from "../render-structure/index.js";

export type SelectorRenderMatchIndexes = {
  renderModel: RenderModel;
  elementsById: Map<string, RenderedElement>;
  emissionSitesById: Map<string, EmissionSite>;
  emissionSiteIdsByElementId: Map<string, string[]>;
  elementIdsByClassName: Map<string, string[]>;
};

export function buildSelectorRenderMatchIndexes(
  renderModel: RenderModel,
): SelectorRenderMatchIndexes {
  const elementIdsByClassName = new Map<string, string[]>();

  for (const emissionSite of renderModel.emissionSites) {
    if (!emissionSite.elementId) {
      continue;
    }

    for (const token of emissionSite.tokens) {
      if (token.tokenKind === "css-module-export") {
        continue;
      }

      pushMapValue(elementIdsByClassName, token.token, emissionSite.elementId);
    }
  }

  sortMapValues(elementIdsByClassName);

  return {
    renderModel,
    elementsById: renderModel.indexes.elementById,
    emissionSitesById: renderModel.indexes.emissionSiteById,
    emissionSiteIdsByElementId: renderModel.indexes.emissionSiteIdsByElementId,
    elementIdsByClassName,
  };
}

function pushMapValue<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function sortMapValues(map: Map<string, string[]>): void {
  for (const [key, values] of map.entries()) {
    map.set(
      key,
      [...new Set(values)].sort((left, right) => left.localeCompare(right)),
    );
  }
}
