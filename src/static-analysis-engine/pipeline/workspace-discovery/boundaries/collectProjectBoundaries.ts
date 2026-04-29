import type { ResolvedScannerConfig } from "../../../../config/index.js";
import { normalizeProjectPath } from "../../../../project/pathUtils.js";
import type { HtmlScriptSourceInput } from "../../external-css/types.js";
import type { ProjectBoundary } from "../types.js";
import { compareProjectBoundaries } from "../utils/sorting.js";

export function collectProjectBoundaries(input: {
  rootDir: string;
  config: ResolvedScannerConfig;
  htmlScriptSources: HtmlScriptSourceInput[];
}): ProjectBoundary[] {
  const boundaries: ProjectBoundary[] = [
    {
      kind: "scan-root",
      rootDir: input.rootDir,
    },
    ...input.config.discovery.sourceRoots.map((sourceRoot) => ({
      kind: "source-root" as const,
      filePath: normalizeProjectPath(sourceRoot),
      source: "config" as const,
    })),
    ...input.htmlScriptSources.flatMap((scriptSource) =>
      scriptSource.resolvedFilePath
        ? [
            {
              kind: "html-app-entry" as const,
              htmlFilePath: scriptSource.filePath,
              entrySourceFilePath: scriptSource.resolvedFilePath,
              appRootPath: scriptSource.appRootPath ?? ".",
            },
          ]
        : [],
    ),
  ];

  return boundaries.sort(compareProjectBoundaries);
}
