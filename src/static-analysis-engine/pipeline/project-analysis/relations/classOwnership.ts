import type { AnalysisTrace } from "../../../types/analysis.js";
import { getAllResolvedModuleFacts } from "../../module-facts/index.js";
import type {
  ClassDefinitionAnalysis,
  ClassOwnershipAnalysis,
  ClassReferenceAnalysis,
  ClassReferenceMatchRelation,
  ComponentAnalysis,
  OwnerCandidate,
  OwnerCandidateReason,
  ProjectAnalysisBuildInput,
  ProjectAnalysisId,
  ProjectAnalysisIndexes,
  StylesheetAnalysis,
} from "../types.js";
import {
  compareById,
  createClassOwnershipId,
  getBaseNameWithoutExtension,
  getDirectoryName,
  getFeatureRoot,
  maxConfidence,
  normalizeProjectPath,
  normalizeSegments,
  pushMapValue,
  pushUniqueMapValue,
  stableHash,
  uniqueSorted,
} from "../internal/shared.js";

export function buildClassOwnership(input: {
  input: ProjectAnalysisBuildInput;
  definitions: ClassDefinitionAnalysis[];
  references: ClassReferenceAnalysis[];
  components: ComponentAnalysis[];
  stylesheets: StylesheetAnalysis[];
  referenceMatches: ClassReferenceMatchRelation[];
  indexes: ProjectAnalysisIndexes;
  includeTraces: boolean;
}): ClassOwnershipAnalysis[] {
  const referencesById = new Map(input.references.map((reference) => [reference.id, reference]));
  const componentsById = new Map(input.components.map((component) => [component.id, component]));
  const componentsBySourceFileId = new Map<ProjectAnalysisId, ComponentAnalysis[]>();
  for (const component of input.components) {
    const sourceFileId = input.indexes.sourceFileIdByPath.get(component.filePath);
    if (sourceFileId) {
      pushMapValue(componentsBySourceFileId, sourceFileId, component);
    }
  }
  const importerComponentsByStylesheetId = buildImporterComponentsByStylesheetId({
    input: input.input,
    componentsBySourceFileId,
    indexes: input.indexes,
  });

  return input.definitions
    .map((definition) => {
      const stylesheet = input.stylesheets.find(
        (candidate) => candidate.id === definition.stylesheetId,
      );
      const consumerSummary = buildClassConsumerSummary({
        definition,
        referenceMatches: input.referenceMatches,
        referencesById,
      });
      const ownerCandidates = buildOwnerCandidates({
        definition,
        stylesheet,
        consumerSummary,
        componentsById,
        importerComponents: importerComponentsByStylesheetId.get(definition.stylesheetId) ?? [],
        includeTraces: input.includeTraces,
      });

      return {
        id: createClassOwnershipId(definition.id),
        classDefinitionId: definition.id,
        stylesheetId: definition.stylesheetId,
        className: definition.className,
        consumerSummary,
        ownerCandidates,
        evidenceKind: getOwnershipEvidenceKind(ownerCandidates, consumerSummary),
        confidence: getOwnershipConfidence(ownerCandidates),
        traces: input.includeTraces
          ? buildClassOwnershipTraces({
              definition,
              stylesheet,
              consumerSummary,
              ownerCandidates,
            })
          : [],
      };
    })
    .sort(compareById);
}

export function buildImporterComponentsByStylesheetId(input: {
  input: ProjectAnalysisBuildInput;
  componentsBySourceFileId: Map<ProjectAnalysisId, ComponentAnalysis[]>;
  indexes: ProjectAnalysisIndexes;
}): Map<ProjectAnalysisId, ComponentAnalysis[]> {
  const importerComponentsByStylesheetId = new Map<ProjectAnalysisId, ComponentAnalysis[]>();
  const stylesheetIdByPath = new Map(input.indexes.stylesheetIdByPath);

  for (const moduleFacts of getAllResolvedModuleFacts({
    moduleFacts: input.input.projectResolution,
  })) {
    const sourceFileId = input.indexes.sourceFileIdByPath.get(
      normalizeProjectPath(moduleFacts.filePath),
    );
    if (!sourceFileId) {
      continue;
    }

    for (const importRecord of moduleFacts.imports) {
      if (importRecord.importKind !== "css") {
        continue;
      }

      const stylesheetId = resolveStylesheetImportId({
        fromFilePath: moduleFacts.filePath,
        specifier: importRecord.specifier,
        resolvedFilePath: importRecord.resolution.resolvedFilePath,
        stylesheetIdByPath,
      });
      if (!stylesheetId) {
        continue;
      }

      for (const component of input.componentsBySourceFileId.get(sourceFileId) ?? []) {
        pushUniqueMapValue(importerComponentsByStylesheetId, stylesheetId, component);
      }
    }
  }

  for (const components of importerComponentsByStylesheetId.values()) {
    components.sort(compareById);
  }

  return importerComponentsByStylesheetId;
}

export function buildClassConsumerSummary(input: {
  definition: ClassDefinitionAnalysis;
  referenceMatches: ClassReferenceMatchRelation[];
  referencesById: Map<ProjectAnalysisId, ClassReferenceAnalysis>;
}): ClassOwnershipAnalysis["consumerSummary"] {
  const matches = input.referenceMatches.filter(
    (match) =>
      match.definitionId === input.definition.id && match.matchKind === "reachable-stylesheet",
  );
  const referenceIds = uniqueSorted(matches.map((match) => match.referenceId));
  const references = referenceIds
    .map((referenceId) => input.referencesById.get(referenceId))
    .filter((reference): reference is ClassReferenceAnalysis => Boolean(reference));

  return {
    classDefinitionId: input.definition.id,
    className: input.definition.className,
    consumerComponentIds: uniqueSorted(
      matches
        .map((match) => {
          const reference = input.referencesById.get(match.referenceId);
          return reference?.classNameComponentIds?.[match.className] ?? reference?.componentId;
        })
        .filter((id): id is string => Boolean(id)),
    ),
    consumerSourceFileIds: uniqueSorted(references.map((reference) => reference.sourceFileId)),
    referenceIds,
    matchIds: uniqueSorted(matches.map((match) => match.id)),
  };
}

export function resolveStylesheetImportId(input: {
  fromFilePath: string;
  specifier: string;
  resolvedFilePath?: string;
  stylesheetIdByPath: Map<string, ProjectAnalysisId>;
}): ProjectAnalysisId | undefined {
  if (input.resolvedFilePath) {
    const stylesheetId = input.stylesheetIdByPath.get(normalizeProjectPath(input.resolvedFilePath));
    if (stylesheetId) {
      return stylesheetId;
    }
  }

  if (!input.specifier.startsWith(".")) {
    return undefined;
  }

  const fromSegments = normalizeProjectPath(input.fromFilePath).split("/");
  fromSegments.pop();
  const specifierSegments = input.specifier.split("/").filter(Boolean);
  const candidateBasePath = normalizeSegments([...fromSegments, ...specifierSegments]);
  const candidatePaths = [candidateBasePath, `${candidateBasePath}.css`];

  for (const candidatePath of candidatePaths) {
    const stylesheetId = input.stylesheetIdByPath.get(candidatePath);
    if (stylesheetId) {
      return stylesheetId;
    }
  }

  return undefined;
}

export function buildOwnerCandidates(input: {
  definition: ClassDefinitionAnalysis;
  stylesheet: StylesheetAnalysis | undefined;
  consumerSummary: ClassOwnershipAnalysis["consumerSummary"];
  componentsById: Map<ProjectAnalysisId, ComponentAnalysis>;
  importerComponents: ComponentAnalysis[];
  includeTraces: boolean;
}): OwnerCandidate[] {
  const candidates: OwnerCandidate[] = [];

  if (input.importerComponents.length === 1) {
    const component = input.importerComponents[0];
    candidates.push(
      createComponentOwnerCandidate({
        component,
        stylesheet: input.stylesheet,
        reasons: ["single-importing-component"],
        confidence: "high",
        summary: `stylesheet for class "${input.definition.className}" is imported by a single component`,
        includeTraces: input.includeTraces,
      }),
    );
  }

  if (input.consumerSummary.consumerComponentIds.length === 1) {
    const component = input.componentsById.get(input.consumerSummary.consumerComponentIds[0]);
    if (component) {
      candidates.push(
        createComponentOwnerCandidate({
          component,
          stylesheet: input.stylesheet,
          reasons: ["single-consuming-component"],
          confidence: "medium",
          summary: `class "${input.definition.className}" is consumed by a single component`,
          includeTraces: input.includeTraces,
        }),
      );
    }
  } else if (input.consumerSummary.consumerComponentIds.length > 1) {
    candidates.push({
      kind: "unknown",
      confidence: "low",
      reasons: ["multi-consumer"],
      traces: input.includeTraces
        ? [
            {
              traceId: `ownership:multi-consumer:${input.definition.id}`,
              category: "rule-evaluation",
              summary: `class "${input.definition.className}" is consumed by multiple components`,
              children: [],
              metadata: {
                classDefinitionId: input.definition.id,
                consumerComponentIds: input.consumerSummary.consumerComponentIds,
              },
            },
          ]
        : [],
    });
  }

  return mergeOwnerCandidates(candidates);
}

export function createComponentOwnerCandidate(input: {
  component: ComponentAnalysis;
  stylesheet: StylesheetAnalysis | undefined;
  reasons: OwnerCandidateReason[];
  confidence: "low" | "medium" | "high";
  summary: string;
  includeTraces: boolean;
}): OwnerCandidate {
  const conventionReasons = getPathConventionReasons({
    componentFilePath: input.component.filePath,
    componentName: input.component.componentName,
    stylesheetFilePath: input.stylesheet?.filePath,
  });
  const reasons = uniqueSorted([...input.reasons, ...conventionReasons]) as OwnerCandidateReason[];

  return {
    kind: "component",
    id: input.component.id,
    path: input.component.filePath,
    confidence: input.confidence,
    reasons,
    traces: input.includeTraces
      ? [
          {
            traceId: `ownership:component-candidate:${input.component.id}:${stableHash(reasons.join("|"))}`,
            category: "rule-evaluation",
            summary: input.summary,
            anchor: input.component.location,
            children: [],
            metadata: {
              componentId: input.component.id,
              componentName: input.component.componentName,
              componentFilePath: input.component.filePath,
              stylesheetFilePath: input.stylesheet?.filePath,
              reasons,
            },
          },
        ]
      : [],
  };
}

export function mergeOwnerCandidates(candidates: OwnerCandidate[]): OwnerCandidate[] {
  const byKey = new Map<string, OwnerCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.id ?? candidate.path ?? "unknown"}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }

    byKey.set(key, {
      ...existing,
      confidence: maxConfidence(existing.confidence, candidate.confidence),
      reasons: uniqueSorted([...existing.reasons, ...candidate.reasons]) as OwnerCandidateReason[],
      traces: [...existing.traces, ...candidate.traces],
    });
  }

  return [...byKey.values()].sort((left, right) =>
    `${left.kind}:${left.id ?? left.path ?? ""}`.localeCompare(
      `${right.kind}:${right.id ?? right.path ?? ""}`,
    ),
  );
}

export function getPathConventionReasons(input: {
  componentFilePath: string;
  componentName: string;
  stylesheetFilePath?: string;
}): OwnerCandidateReason[] {
  if (!input.stylesheetFilePath) {
    return [];
  }

  const componentDir = getDirectoryName(input.componentFilePath);
  const stylesheetDir = getDirectoryName(input.stylesheetFilePath);
  const componentBaseName = getBaseNameWithoutExtension(input.componentFilePath);
  const stylesheetBaseName = getBaseNameWithoutExtension(input.stylesheetFilePath);
  const reasons: OwnerCandidateReason[] = [];

  if (componentDir === stylesheetDir) {
    reasons.push("same-directory");
    if (componentBaseName === stylesheetBaseName) {
      reasons.push("sibling-basename-convention");
    }
    if (
      componentBaseName === "index" &&
      (stylesheetBaseName === input.componentName || stylesheetBaseName === "styles")
    ) {
      reasons.push("component-folder-convention");
    }
  }

  const componentFeatureRoot = getFeatureRoot(input.componentFilePath);
  const stylesheetFeatureRoot = getFeatureRoot(input.stylesheetFilePath);
  if (
    componentFeatureRoot &&
    stylesheetFeatureRoot &&
    componentFeatureRoot === stylesheetFeatureRoot
  ) {
    reasons.push("feature-folder-convention");
  }

  return uniqueSorted(reasons) as OwnerCandidateReason[];
}

export function getOwnershipEvidenceKind(
  candidates: OwnerCandidate[],
  consumerSummary: ClassOwnershipAnalysis["consumerSummary"],
): ClassOwnershipAnalysis["evidenceKind"] {
  if (candidates.some((candidate) => candidate.reasons.includes("single-importing-component"))) {
    return "single-importing-component";
  }
  if (candidates.some((candidate) => candidate.reasons.includes("single-consuming-component"))) {
    return "single-consuming-component";
  }
  if (consumerSummary.consumerComponentIds.length > 1) {
    return "multi-consumer";
  }
  if (
    candidates.some((candidate) =>
      candidate.reasons.some((reason) =>
        [
          "same-directory",
          "sibling-basename-convention",
          "component-folder-convention",
          "feature-folder-convention",
        ].includes(reason),
      ),
    )
  ) {
    return "path-convention";
  }
  return "unknown";
}

export function getOwnershipConfidence(candidates: OwnerCandidate[]): "low" | "medium" | "high" {
  return candidates.reduce(
    (confidence, candidate) => maxConfidence(confidence, candidate.confidence),
    "low" as "low" | "medium" | "high",
  );
}

export function buildClassOwnershipTraces(input: {
  definition: ClassDefinitionAnalysis;
  stylesheet: StylesheetAnalysis | undefined;
  consumerSummary: ClassOwnershipAnalysis["consumerSummary"];
  ownerCandidates: OwnerCandidate[];
}): AnalysisTrace[] {
  return [
    {
      traceId: `ownership:class:${input.definition.id}`,
      category: "rule-evaluation",
      summary: `ownership evidence was collected for class "${input.definition.className}"`,
      anchor: input.stylesheet?.filePath
        ? {
            filePath: input.stylesheet.filePath,
            startLine: input.definition.line,
            startColumn: 1,
          }
        : undefined,
      children: input.ownerCandidates.flatMap((candidate) => candidate.traces),
      metadata: {
        classDefinitionId: input.definition.id,
        className: input.definition.className,
        consumerComponentIds: input.consumerSummary.consumerComponentIds,
        consumerSourceFileIds: input.consumerSummary.consumerSourceFileIds,
      },
    },
  ];
}
