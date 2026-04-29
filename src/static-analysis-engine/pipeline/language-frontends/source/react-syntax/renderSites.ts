import ts from "typescript";

import { toSourceAnchor } from "../../../../libraries/react-components/reactComponentAstUtils.js";
import { createSiteKey } from "./keys.js";
import { getJsxTagName, isHelperReturnStatement, isIntrinsicTagName } from "./jsxUtils.js";
import type { ReactRenderSiteFact } from "./types.js";

export function tryCreateRenderSite(input: {
  node: ts.Node;
  filePath: string;
  sourceFile: ts.SourceFile;
  emittingComponentKey?: string;
  parentSiteKey?: string;
}): ReactRenderSiteFact | undefined {
  if (
    !ts.isJsxElement(input.node) &&
    !ts.isJsxSelfClosingElement(input.node) &&
    !ts.isJsxFragment(input.node) &&
    !ts.isConditionalExpression(input.node) &&
    !isHelperReturnStatement(input.node)
  ) {
    return undefined;
  }

  const location = toSourceAnchor(input.node, input.sourceFile, input.filePath);
  const kind = getRenderSiteKind(input.node);
  return {
    siteKey: createSiteKey(kind, location, input.emittingComponentKey),
    kind,
    filePath: input.filePath,
    location,
    ...(input.emittingComponentKey
      ? {
          emittingComponentKey: input.emittingComponentKey,
          placementComponentKey: input.emittingComponentKey,
        }
      : {}),
    ...(input.parentSiteKey ? { parentSiteKey: input.parentSiteKey } : {}),
  };
}

function getRenderSiteKind(node: ts.Node): ReactRenderSiteFact["kind"] {
  if (ts.isJsxFragment(node)) {
    return "jsx-fragment";
  }
  if (ts.isConditionalExpression(node)) {
    return "conditional";
  }
  if (isHelperReturnStatement(node)) {
    return "helper-return";
  }
  const tagName = getJsxTagName(node);
  if (tagName && !isIntrinsicTagName(tagName)) {
    return "component-reference";
  }
  return "jsx-element";
}
