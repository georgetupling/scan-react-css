import type { ProjectModel } from "../model/types.js";

export type DefinitionReachability =
  | "direct"
  | "import-context"
  | "render-context-definite"
  | "render-context-possible"
  | "unreachable";

export function isDefinitionReachable(
  model: ProjectModel,
  sourceFilePath: string,
  cssFilePath: string,
  externalSpecifier?: string,
): boolean {
  return (
    getDefinitionReachabilityStatus(model, sourceFilePath, cssFilePath, externalSpecifier) !==
    "unreachable"
  );
}

export function getDefinitionReachabilityStatus(
  model: ProjectModel,
  sourceFilePath: string,
  cssFilePath: string,
  externalSpecifier?: string,
): DefinitionReachability {
  const reachability = model.reachability.get(sourceFilePath);
  const cssFile = model.indexes.cssFileByPath.get(cssFilePath);
  if (!reachability) {
    return "unreachable";
  }

  if (externalSpecifier) {
    return reachability.externalCss.has(externalSpecifier) ? "direct" : "unreachable";
  }

  if (!cssFile) {
    return "unreachable";
  }

  if (cssFile.category === "global") {
    return reachability.globalCss.has(cssFilePath) ? "direct" : "unreachable";
  }

  if (reachability.directLocalCss.has(cssFilePath)) {
    return "direct";
  }

  if (reachability.renderContextDefiniteLocalCss.has(cssFilePath)) {
    return "render-context-definite";
  }

  if (reachability.renderContextPossibleLocalCss.has(cssFilePath)) {
    return "render-context-possible";
  }

  if (reachability.importContextLocalCss.has(cssFilePath)) {
    return "import-context";
  }

  return "unreachable";
}

export function compareReachability(
  left: DefinitionReachability,
  right: DefinitionReachability,
): number {
  return reachabilityRank(right) - reachabilityRank(left);
}

export function reachabilityRank(value: DefinitionReachability): number {
  switch (value) {
    case "direct":
      return 5;
    case "import-context":
      return 4;
    case "render-context-definite":
      return 3;
    case "render-context-possible":
      return 2;
    default:
      return 1;
  }
}
