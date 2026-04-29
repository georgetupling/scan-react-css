import ts from "typescript";

import { createSiteKey } from "./keys.js";
import { getJsxTagName, isIntrinsicTagName } from "./jsxUtils.js";
import type { ReactElementTemplateFact, ReactRenderSiteFact } from "./types.js";

export function tryCreateElementTemplate(input: {
  node: ts.Node;
  filePath: string;
  renderSite: ReactRenderSiteFact;
}): ReactElementTemplateFact | undefined {
  if (ts.isJsxFragment(input.node)) {
    return {
      templateKey: createSiteKey("element-template", input.renderSite.location, "fragment"),
      kind: "fragment",
      filePath: input.filePath,
      location: input.renderSite.location,
      name: "fragment",
      renderSiteKey: input.renderSite.siteKey,
      ...(input.renderSite.emittingComponentKey
        ? { emittingComponentKey: input.renderSite.emittingComponentKey }
        : {}),
      ...(input.renderSite.placementComponentKey
        ? { placementComponentKey: input.renderSite.placementComponentKey }
        : {}),
    };
  }

  const tagName = getJsxTagName(input.node);
  if (!tagName) {
    return undefined;
  }

  return {
    templateKey: createSiteKey("element-template", input.renderSite.location, tagName),
    kind: isIntrinsicTagName(tagName) ? "intrinsic" : "component-candidate",
    filePath: input.filePath,
    location: input.renderSite.location,
    name: tagName,
    renderSiteKey: input.renderSite.siteKey,
    ...(input.renderSite.emittingComponentKey
      ? { emittingComponentKey: input.renderSite.emittingComponentKey }
      : {}),
    ...(input.renderSite.placementComponentKey
      ? { placementComponentKey: input.renderSite.placementComponentKey }
      : {}),
  };
}
