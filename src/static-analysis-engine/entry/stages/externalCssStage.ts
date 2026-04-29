import {
  buildExternalCssSummary,
  type ExternalCssAnalysisInput,
} from "../../pipeline/external-css/index.js";
import type {
  ProjectExternalCssSurface,
  ProjectResourceEdge,
} from "../../pipeline/workspace-discovery/index.js";
import type { ExternalCssStageResult } from "./types.js";

export function runExternalCssStage(input: {
  externalCss?: ExternalCssAnalysisInput | ProjectExternalCssSurface;
  resourceEdges?: ProjectResourceEdge[];
}): ExternalCssStageResult {
  return {
    externalCssSummary: buildExternalCssSummary(toExternalCssAnalysisInput(input)),
  };
}

function toExternalCssAnalysisInput(input: {
  externalCss?: ExternalCssAnalysisInput | ProjectExternalCssSurface;
  resourceEdges?: ProjectResourceEdge[];
}): ExternalCssAnalysisInput | undefined {
  if (!input.resourceEdges) {
    return input.externalCss;
  }

  return {
    fetchRemote: input.externalCss?.fetchRemote,
    globalProviders: input.externalCss?.globalProviders,
    htmlStylesheetLinks: input.resourceEdges
      .filter((edge) => edge.kind === "html-stylesheet")
      .map((edge) => ({
        filePath: edge.fromHtmlFilePath,
        href: edge.href,
        isRemote: edge.isRemote,
        ...(edge.resolvedFilePath ? { resolvedFilePath: edge.resolvedFilePath } : {}),
      })),
    htmlScriptSources: input.resourceEdges
      .filter((edge) => edge.kind === "html-script")
      .map((edge) => ({
        filePath: edge.fromHtmlFilePath,
        src: edge.src,
        ...(edge.resolvedFilePath ? { resolvedFilePath: edge.resolvedFilePath } : {}),
        ...(edge.appRootPath ? { appRootPath: edge.appRootPath } : {}),
      })),
    packageCssImports: input.resourceEdges
      .filter((edge) => edge.kind === "package-css-import")
      .map((edge) => ({
        importerKind: edge.importerKind,
        importerFilePath: edge.importerFilePath,
        specifier: edge.specifier,
        resolvedFilePath: edge.resolvedFilePath,
      })),
  };
}
