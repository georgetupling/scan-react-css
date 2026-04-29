import type {
  ReactClassExpressionSiteFact,
  ReactComponentDeclarationFact,
  ReactElementTemplateFact,
  ReactRenderSiteFact,
} from "./types.js";

export function compareComponents(
  left: ReactComponentDeclarationFact,
  right: ReactComponentDeclarationFact,
): number {
  return left.componentKey.localeCompare(right.componentKey);
}

export function compareRenderSites(left: ReactRenderSiteFact, right: ReactRenderSiteFact): number {
  return left.siteKey.localeCompare(right.siteKey);
}

export function compareElementTemplates(
  left: ReactElementTemplateFact,
  right: ReactElementTemplateFact,
): number {
  return left.templateKey.localeCompare(right.templateKey);
}

export function compareClassExpressionSites(
  left: ReactClassExpressionSiteFact,
  right: ReactClassExpressionSiteFact,
): number {
  return left.siteKey.localeCompare(right.siteKey);
}
