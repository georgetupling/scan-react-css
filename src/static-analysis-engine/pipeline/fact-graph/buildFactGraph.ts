import { buildFactGraphIndexes } from "./indexes.js";
import {
  fileResourceNodeId,
  moduleNodeId,
  originatesFromFileEdgeId,
  stylesheetNodeId,
} from "./ids.js";
import {
  factGraphProvenance,
  frontendFileProvenance,
  workspaceFileProvenance,
} from "./provenance.js";
import type {
  FactEdge,
  FactGraphInput,
  FactGraphResult,
  FactNode,
  FileResourceNode,
  ModuleNode,
  OriginatesFromFileEdge,
  StyleSheetNode,
} from "./types.js";

export function buildFactGraph(input: FactGraphInput): FactGraphResult {
  const fileNodes = buildFileNodes(input);
  const moduleNodes = buildModuleNodes(input);
  const stylesheetNodes = buildStylesheetNodes(input);
  const nodes = sortNodes([...fileNodes, ...moduleNodes, ...stylesheetNodes]);
  const edges = sortEdges(
    buildOriginatesFromFileEdges({ fileNodes, moduleNodes, stylesheetNodes }),
  );
  const { indexes, diagnostics } = buildFactGraphIndexes({ nodes, edges });

  return {
    snapshot: input.snapshot,
    frontends: input.frontends,
    graph: {
      meta: {
        rootDir: input.snapshot.rootDir,
        sourceFileCount: input.snapshot.files.sourceFiles.length,
        stylesheetCount: input.snapshot.files.stylesheets.length,
        htmlFileCount: input.snapshot.files.htmlFiles.length,
        generatedAtStage: "fact-graph",
      },
      nodes: {
        all: nodes,
        modules: moduleNodes,
        components: [],
        renderSites: [],
        elementTemplates: [],
        classExpressionSites: [],
        stylesheets: stylesheetNodes,
        ruleDefinitions: [],
        selectors: [],
        selectorBranches: [],
        ownerCandidates: [],
        files: fileNodes,
        externalResources: [],
      },
      edges: {
        all: edges,
        imports: [],
        renders: [],
        contains: [],
        referencesClassExpression: [],
        definesSelector: [],
        originatesFromFile: edges,
        belongsToOwnerCandidate: [],
      },
      indexes,
      diagnostics,
    },
  };
}

function buildFileNodes(input: FactGraphInput): FileResourceNode[] {
  const sourceFileNodes = input.snapshot.files.sourceFiles.map(
    (file): FileResourceNode => ({
      id: fileResourceNodeId(file.filePath),
      kind: "file-resource",
      filePath: file.filePath,
      absolutePath: file.absolutePath,
      fileKind: "source",
      confidence: "high",
      provenance: workspaceFileProvenance({
        filePath: file.filePath,
        summary: "Discovered source file",
      }),
    }),
  );
  const stylesheetFileNodes = input.snapshot.files.stylesheets.map(
    (file): FileResourceNode => ({
      id: fileResourceNodeId(file.filePath),
      kind: "file-resource",
      filePath: file.filePath,
      absolutePath: file.absolutePath,
      fileKind: "stylesheet",
      confidence: "high",
      provenance: workspaceFileProvenance({
        filePath: file.filePath,
        summary: "Discovered stylesheet file",
      }),
    }),
  );
  const htmlFileNodes = input.snapshot.files.htmlFiles.map(
    (file): FileResourceNode => ({
      id: fileResourceNodeId(file.filePath),
      kind: "file-resource",
      filePath: file.filePath,
      absolutePath: file.absolutePath,
      fileKind: "html",
      confidence: "high",
      provenance: workspaceFileProvenance({
        filePath: file.filePath,
        summary: "Discovered HTML file",
      }),
    }),
  );
  const configFileNodes = input.snapshot.files.configFiles
    .filter((file): file is typeof file & { filePath: string } => Boolean(file.filePath))
    .map(
      (file): FileResourceNode => ({
        id: fileResourceNodeId(file.filePath),
        kind: "file-resource",
        filePath: file.filePath,
        fileKind: "config",
        confidence: "high",
        provenance: workspaceFileProvenance({
          filePath: file.filePath,
          summary: "Loaded config file",
        }),
      }),
    );

  return sortNodes([
    ...sourceFileNodes,
    ...stylesheetFileNodes,
    ...htmlFileNodes,
    ...configFileNodes,
  ]) as FileResourceNode[];
}

function buildModuleNodes(input: FactGraphInput): ModuleNode[] {
  return sortNodes(
    input.frontends.source.files.map(
      (file): ModuleNode => ({
        id: moduleNodeId(file.filePath),
        kind: "module",
        filePath: file.filePath,
        absolutePath: file.absolutePath,
        moduleKind: "source",
        languageKind: file.languageKind,
        confidence: "high",
        provenance: frontendFileProvenance({
          filePath: file.filePath,
          summary: "Extracted source module frontend facts",
        }),
      }),
    ),
  ) as ModuleNode[];
}

function buildStylesheetNodes(input: FactGraphInput): StyleSheetNode[] {
  return sortNodes(
    input.frontends.css.files.map(
      (file): StyleSheetNode => ({
        id: stylesheetNodeId(file.filePath),
        kind: "stylesheet",
        filePath: file.filePath,
        absolutePath: file.absolutePath,
        cssKind: file.cssKind,
        origin: file.origin,
        confidence: "high",
        provenance: frontendFileProvenance({
          filePath: file.filePath,
          summary: "Extracted stylesheet frontend facts",
        }),
      }),
    ),
  ) as StyleSheetNode[];
}

function buildOriginatesFromFileEdges(input: {
  fileNodes: FileResourceNode[];
  moduleNodes: ModuleNode[];
  stylesheetNodes: StyleSheetNode[];
}): OriginatesFromFileEdge[] {
  const fileNodeIdsByPath = new Map(input.fileNodes.map((node) => [node.filePath, node.id]));
  const moduleEdges = input.moduleNodes.flatMap((node): OriginatesFromFileEdge[] => {
    const fileNodeId = fileNodeIdsByPath.get(node.filePath);
    if (!fileNodeId) {
      return [];
    }

    return [buildOriginatesFromFileEdge(node.id, fileNodeId)];
  });
  const stylesheetEdges = input.stylesheetNodes.flatMap((node): OriginatesFromFileEdge[] => {
    if (!node.filePath || node.origin === "remote") {
      return [];
    }

    const fileNodeId = fileNodeIdsByPath.get(node.filePath);
    if (!fileNodeId) {
      return [];
    }

    return [buildOriginatesFromFileEdge(node.id, fileNodeId)];
  });

  return [...moduleEdges, ...stylesheetEdges];
}

function buildOriginatesFromFileEdge(from: string, to: string): OriginatesFromFileEdge {
  return {
    id: originatesFromFileEdgeId(from, to),
    kind: "originates-from-file",
    from,
    to,
    confidence: "high",
    provenance: factGraphProvenance("Linked graph node to originating file resource"),
  };
}

function sortNodes<T extends FactNode>(nodes: T[]): T[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

function sortEdges<T extends FactEdge>(edges: T[]): T[] {
  return [...edges].sort((left, right) => left.id.localeCompare(right.id));
}
