import ts from "typescript";

import { toSourceAnchor } from "../../../../libraries/react-components/reactComponentAstUtils.js";
import { createSiteKey } from "./keys.js";
import { getJsxTagName, isIntrinsicTagName, unwrapJsxAttributeInitializer } from "./jsxUtils.js";
import type {
  ReactClassExpressionSiteFact,
  ReactElementTemplateFact,
  ReactRenderSiteFact,
} from "./types.js";

export function tryCreateJsxClassExpressionSite(input: {
  node: ts.Node;
  filePath: string;
  sourceFile: ts.SourceFile;
  renderSite?: ReactRenderSiteFact;
  template?: ReactElementTemplateFact;
  emittingComponentKey?: string;
}): ReactClassExpressionSiteFact | undefined {
  if (!ts.isJsxElement(input.node) && !ts.isJsxSelfClosingElement(input.node)) {
    return undefined;
  }

  const attributes = ts.isJsxElement(input.node)
    ? input.node.openingElement.attributes.properties
    : input.node.attributes.properties;
  const classNameAttribute = attributes.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) && attribute.name.text === "className",
  );
  if (!classNameAttribute?.initializer) {
    return undefined;
  }

  const tagName = getJsxTagName(input.node) ?? "";
  const expression = unwrapJsxAttributeInitializer(classNameAttribute.initializer);
  const anchorNode = expression ?? classNameAttribute.initializer;
  const location = toSourceAnchor(anchorNode, input.sourceFile, input.filePath);
  const emittingComponentKey = input.renderSite?.emittingComponentKey ?? input.emittingComponentKey;
  const placementComponentKey = input.renderSite?.placementComponentKey ?? emittingComponentKey;
  return {
    siteKey: createSiteKey(
      "class-expression",
      location,
      input.renderSite?.siteKey ?? "standalone-jsx-class",
    ),
    kind: isIntrinsicTagName(tagName) ? "jsx-class" : "component-prop-class",
    filePath: input.filePath,
    location,
    rawExpressionText: anchorNode.getText(input.sourceFile),
    ...(emittingComponentKey ? { emittingComponentKey } : {}),
    ...(placementComponentKey ? { placementComponentKey } : {}),
    ...(input.renderSite ? { renderSiteKey: input.renderSite.siteKey } : {}),
    ...(input.template ? { elementTemplateKey: input.template.templateKey } : {}),
  };
}

export function tryCreateCssModuleClassExpressionSite(input: {
  node: ts.Node;
  filePath: string;
  sourceFile: ts.SourceFile;
  cssModuleNamespaceNames: ReadonlySet<string>;
  emittingComponentKey?: string;
}): ReactClassExpressionSiteFact | undefined {
  if (
    !ts.isPropertyAccessExpression(input.node) ||
    !ts.isIdentifier(input.node.expression) ||
    !input.cssModuleNamespaceNames.has(input.node.expression.text)
  ) {
    return undefined;
  }

  const location = toSourceAnchor(input.node, input.sourceFile, input.filePath);
  return {
    siteKey: createSiteKey("class-expression", location, "css-module-member"),
    kind: "css-module-member",
    filePath: input.filePath,
    location,
    rawExpressionText: input.node.getText(input.sourceFile),
    ...(input.emittingComponentKey
      ? {
          emittingComponentKey: input.emittingComponentKey,
          placementComponentKey: input.emittingComponentKey,
        }
      : {}),
  };
}

export function dedupeClassExpressionSites(
  sites: ReactClassExpressionSiteFact[],
): ReactClassExpressionSiteFact[] {
  const byKey = new Map<string, ReactClassExpressionSiteFact>();
  for (const site of sites) {
    byKey.set(site.siteKey, site);
  }
  return [...byKey.values()];
}
