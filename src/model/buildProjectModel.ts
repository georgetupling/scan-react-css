import { buildActiveExternalCssProviders } from "./builders/buildActiveExternalCssProviders.js";
import { buildCssFileNodes } from "./builders/buildCssFileNodes.js";
import { buildExternalCssResources } from "./builders/buildExternalCssResources.js";
import { buildGraphEdges } from "./builders/buildGraphEdges.js";
import { buildProjectIndexes } from "./builders/buildProjectIndexes.js";
import { buildSourceFileNodes } from "./builders/buildSourceFileNodes.js";
import { buildReachability } from "./reachability/buildReachability.js";
import type { BuildProjectModelInput, ProjectModel } from "./types.js";

export function buildProjectModel({ config, facts }: BuildProjectModelInput): ProjectModel {
  const sourceFiles = buildSourceFileNodes(facts.sourceFacts);
  const sourceFileByPath = new Map(sourceFiles.map((sourceFile) => [sourceFile.path, sourceFile]));

  const cssFiles = buildCssFileNodes(facts, config, sourceFileByPath);
  const externalCssResources = buildExternalCssResources(sourceFiles, facts, config);
  const activeExternalCssProviders = buildActiveExternalCssProviders(config, facts);
  const edges = buildGraphEdges(sourceFiles, cssFiles, externalCssResources);
  const reachability = buildReachability({
    sourceFiles,
    cssFiles,
    config,
    facts,
  });
  const indexes = buildProjectIndexes(
    sourceFiles,
    cssFiles,
    externalCssResources,
    activeExternalCssProviders,
    reachability,
  );

  return {
    config,
    facts,
    graph: {
      sourceFiles,
      cssFiles,
      externalCssResources,
      edges,
    },
    indexes,
    reachability,
  };
}
