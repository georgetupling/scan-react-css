import path from "node:path";
import type { ResolvedScanReactCssConfig } from "../../config/types.js";
import { matchesAnyGlob, normalizePathForMatch } from "../../files/pathUtils.js";
import type { CssOwnership, CssResourceCategory, SourceFileNode } from "../types.js";

export function classifyCssOwnership(
  filePath: string,
  config: ResolvedScanReactCssConfig,
  sourceFileByPath: Map<string, SourceFileNode>,
): CssOwnership {
  const normalizedPath = normalizePathForMatch(filePath);

  // Deterministic precedence:
  // 1. explicit global patterns
  // 2. explicit utility patterns
  // 3. explicit page patterns
  // 4. explicit component patterns
  // 5. optional sibling naming convention
  // 6. otherwise unclassified
  if (matchesAnyGlob(normalizedPath, config.css.global)) {
    return "global";
  }

  if (matchesAnyGlob(normalizedPath, config.css.utilities)) {
    return "utility";
  }

  if (matchesAnyGlob(normalizedPath, config.ownership.pagePatterns)) {
    return "page";
  }

  if (matchesAnyGlob(normalizedPath, config.ownership.componentCssPatterns)) {
    return "component";
  }

  if (
    config.ownership.namingConvention === "sibling" &&
    hasSiblingSourceMatch(normalizedPath, sourceFileByPath)
  ) {
    return "component";
  }

  return "unclassified";
}

export function classifyCssCategory(ownership: CssOwnership): CssResourceCategory {
  if (ownership === "global") {
    return "global";
  }

  if (ownership === "external") {
    return "external";
  }

  return "local";
}

function hasSiblingSourceMatch(
  cssFilePath: string,
  sourceFileByPath: Map<string, SourceFileNode>,
): boolean {
  const cssBaseName = path.basename(cssFilePath, path.extname(cssFilePath));
  const cssDirectory = normalizePathForMatch(path.dirname(cssFilePath));

  for (const sourceFilePath of sourceFileByPath.keys()) {
    const sourceDirectory = normalizePathForMatch(path.dirname(sourceFilePath));
    const sourceBaseName = path.basename(sourceFilePath, path.extname(sourceFilePath));

    if (cssDirectory === sourceDirectory && cssBaseName === sourceBaseName) {
      return true;
    }
  }

  return false;
}
