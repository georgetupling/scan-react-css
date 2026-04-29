import type { FactEdge, FactGraphDiagnostic, FactGraphIndexes, FactNode } from "./types.js";
import { factGraphProvenance } from "./provenance.js";

export function buildFactGraphIndexes(input: { nodes: FactNode[]; edges: FactEdge[] }): {
  indexes: FactGraphIndexes;
  diagnostics: FactGraphDiagnostic[];
} {
  const diagnostics: FactGraphDiagnostic[] = [];
  const nodesById = new Map<string, FactNode>();
  const edgesById = new Map<string, FactEdge>();
  const fileNodeIdByPath = new Map<string, string>();
  const moduleNodeIdByFilePath = new Map<string, string>();
  const stylesheetNodeIdByFilePath = new Map<string, string>();

  for (const node of input.nodes) {
    if (nodesById.has(node.id)) {
      diagnostics.push({
        stage: "fact-graph",
        severity: "error",
        code: "duplicate-graph-id",
        message: `Duplicate fact graph node id: ${node.id}`,
        provenance: factGraphProvenance("Detected duplicate fact graph node id"),
      });
    }

    nodesById.set(node.id, node);

    if (node.kind === "file-resource") {
      fileNodeIdByPath.set(node.filePath, node.id);
    } else if (node.kind === "module") {
      moduleNodeIdByFilePath.set(node.filePath, node.id);
    } else if (node.kind === "stylesheet" && node.filePath) {
      stylesheetNodeIdByFilePath.set(node.filePath, node.id);
    }
  }

  for (const edge of input.edges) {
    if (edgesById.has(edge.id)) {
      diagnostics.push({
        stage: "fact-graph",
        severity: "error",
        code: "duplicate-graph-id",
        message: `Duplicate fact graph edge id: ${edge.id}`,
        provenance: factGraphProvenance("Detected duplicate fact graph edge id"),
      });
    }

    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      diagnostics.push({
        stage: "fact-graph",
        severity: "error",
        code: "unresolved-graph-edge-target",
        message: `Fact graph edge ${edge.id} references a missing node`,
        provenance: edge.provenance,
      });
    }

    edgesById.set(edge.id, edge);
  }

  return {
    indexes: {
      nodesById,
      edgesById,
      fileNodeIdByPath,
      moduleNodeIdByFilePath,
      stylesheetNodeIdByFilePath,
    },
    diagnostics,
  };
}
