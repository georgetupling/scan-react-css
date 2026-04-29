import path from "node:path";

import type {
  BelongsToOwnerCandidateEdge,
  ComponentNode,
  FactGraphInput,
  FileResourceNode,
  ModuleNode,
  OwnerCandidateNode,
  StyleSheetNode,
} from "../types.js";
import {
  belongsToOwnerCandidateEdgeId,
  fileResourceNodeId,
  moduleNodeId,
  ownerCandidateNodeId,
} from "../ids.js";
import { factGraphProvenance } from "../provenance.js";
import { sortEdges, sortNodes } from "../utils/sortGraphElements.js";

export type BuiltOwnerCandidateSeeds = {
  ownerCandidates: OwnerCandidateNode[];
  belongsToOwnerCandidate: BelongsToOwnerCandidateEdge[];
};

export function buildOwnerCandidateSeeds(input: {
  graphInput: FactGraphInput;
  components: ComponentNode[];
  modules: ModuleNode[];
  stylesheets: StyleSheetNode[];
  files: FileResourceNode[];
}): BuiltOwnerCandidateSeeds {
  const ownerCandidatesById = new Map<string, OwnerCandidateNode>();
  const belongsToOwnerCandidate: BelongsToOwnerCandidateEdge[] = [];

  for (const component of input.components) {
    const owner = upsertOwnerCandidate(ownerCandidatesById, {
      ownerCandidateKind: "component",
      ownerKey: component.componentKey,
      displayName: component.componentName,
      seedReason: "component declaration",
    });
    belongsToOwnerCandidate.push(buildBelongsToOwnerCandidateEdge(component.id, owner.id));
  }

  for (const moduleNode of input.modules) {
    addFileAndDirectoryOwners({
      filePath: moduleNode.filePath,
      sourceNodeId: moduleNode.id,
      ownerCandidatesById,
      belongsToOwnerCandidate,
    });
  }

  for (const stylesheet of input.stylesheets) {
    if (!stylesheet.filePath) {
      continue;
    }

    addFileAndDirectoryOwners({
      filePath: stylesheet.filePath,
      sourceNodeId: stylesheet.id,
      ownerCandidatesById,
      belongsToOwnerCandidate,
    });
  }

  for (const file of input.files) {
    if (file.fileKind !== "source" && file.fileKind !== "stylesheet") {
      continue;
    }

    addFileAndDirectoryOwners({
      filePath: file.filePath,
      sourceNodeId: file.id,
      ownerCandidatesById,
      belongsToOwnerCandidate,
    });
  }

  for (const boundary of input.graphInput.snapshot.boundaries) {
    if (boundary.kind !== "workspace-package") {
      continue;
    }

    const owner = upsertOwnerCandidate(ownerCandidatesById, {
      ownerCandidateKind: "workspace-package",
      ownerKey: boundary.packageName,
      displayName: boundary.packageName,
      seedReason: boundary.reason,
      confidence: "medium",
    });
    belongsToOwnerCandidate.push(
      buildBelongsToOwnerCandidateEdge(moduleNodeId(boundary.entryFilePath), owner.id),
    );
    belongsToOwnerCandidate.push(
      buildBelongsToOwnerCandidateEdge(fileResourceNodeId(boundary.entryFilePath), owner.id),
    );
  }

  return {
    ownerCandidates: sortNodes([...ownerCandidatesById.values()]),
    belongsToOwnerCandidate: sortEdges(dedupeEdges(belongsToOwnerCandidate)),
  };
}

function addFileAndDirectoryOwners(input: {
  filePath: string;
  sourceNodeId: string;
  ownerCandidatesById: Map<string, OwnerCandidateNode>;
  belongsToOwnerCandidate: BelongsToOwnerCandidateEdge[];
}): void {
  const normalizedFilePath = normalizeFilePath(input.filePath);
  const fileOwner = upsertOwnerCandidate(input.ownerCandidatesById, {
    ownerCandidateKind: "source-file",
    ownerKey: normalizedFilePath,
    displayName: normalizedFilePath,
    seedReason: "file resource path",
  });
  input.belongsToOwnerCandidate.push(
    buildBelongsToOwnerCandidateEdge(input.sourceNodeId, fileOwner.id),
  );

  const directoryPath = path.posix.dirname(normalizedFilePath);
  if (!directoryPath || directoryPath === ".") {
    return;
  }

  const directoryOwner = upsertOwnerCandidate(input.ownerCandidatesById, {
    ownerCandidateKind: "directory",
    ownerKey: directoryPath,
    displayName: directoryPath,
    seedReason: "containing directory path",
  });
  input.belongsToOwnerCandidate.push(
    buildBelongsToOwnerCandidateEdge(input.sourceNodeId, directoryOwner.id),
  );
}

function upsertOwnerCandidate(
  ownerCandidatesById: Map<string, OwnerCandidateNode>,
  input: {
    ownerCandidateKind: OwnerCandidateNode["ownerCandidateKind"];
    ownerKey: string;
    displayName: string;
    seedReason: string;
    confidence?: OwnerCandidateNode["confidence"];
  },
): OwnerCandidateNode {
  const normalizedOwnerKey = normalizeFilePath(input.ownerKey);
  const nodeId = ownerCandidateNodeId(input.ownerCandidateKind, normalizedOwnerKey);
  const existing = ownerCandidatesById.get(nodeId);
  if (existing) {
    return existing;
  }

  const node: OwnerCandidateNode = {
    id: nodeId,
    kind: "owner-candidate",
    ownerCandidateKind: input.ownerCandidateKind,
    ownerKey: normalizedOwnerKey,
    displayName: input.displayName,
    seedReason: input.seedReason,
    confidence: input.confidence ?? "high",
    provenance: factGraphProvenance(`Seeded ${input.ownerCandidateKind} owner candidate`),
  };
  ownerCandidatesById.set(nodeId, node);
  return node;
}

function buildBelongsToOwnerCandidateEdge(from: string, to: string): BelongsToOwnerCandidateEdge {
  return {
    id: belongsToOwnerCandidateEdgeId(from, to),
    kind: "belongs-to-owner-candidate",
    from,
    to,
    confidence: "high",
    provenance: factGraphProvenance("Linked fact to owner candidate seed"),
  };
}

function dedupeEdges(edges: BelongsToOwnerCandidateEdge[]): BelongsToOwnerCandidateEdge[] {
  return [...new Map(edges.map((edge) => [edge.id, edge])).values()];
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
