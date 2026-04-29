import type { SourceImportEdge } from "../workspace-discovery/index.js";
import { normalizeFilePath } from "./shared/pathUtils.js";

export function collectSourceImportEdgesByImportKey(
  resourceEdges: readonly { kind: string }[],
): Map<string, SourceImportEdge> {
  return new Map(
    resourceEdges
      .filter((edge): edge is SourceImportEdge => edge.kind === "source-import")
      .map((edge) => [createSourceImportEdgeKey(edge), edge]),
  );
}

export function createSourceImportEdgeKey(input: {
  importerFilePath: string;
  specifier: string;
  importKind: string;
}): string {
  return `${normalizeFilePath(input.importerFilePath)}\0${input.specifier}\0${input.importKind}`;
}
