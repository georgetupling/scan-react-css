import { classOwnershipEvidenceId, styleOwnerCandidateId } from "./ids.js";
import type { ProjectEvidenceAssemblyResult } from "../project-evidence/index.js";
import type {
  ClassDefinitionAnalysis,
  ComponentAnalysis,
  StylesheetAnalysis,
} from "../project-evidence/index.js";
import type {
  ClassConsumerSummary,
  ClassDefinitionConsumerEvidence,
  ClassOwnershipEvidence,
  OwnershipCandidateReason,
  OwnershipEvidenceKind,
  OwnershipInferenceResult,
  StyleOwnerCandidate,
  StylesheetOwnershipEvidence,
} from "./types.js";

type CompatibilityEvidenceKind = NonNullable<ClassOwnershipEvidence["compatibilityEvidenceKind"]>;

export function buildClassOwnershipEvidence(input: {
  projectEvidence: ProjectEvidenceAssemblyResult;
  definitionConsumers: ClassDefinitionConsumerEvidence[];
  stylesheetOwnership: StylesheetOwnershipEvidence[];
  includeTraces: boolean;
}): Pick<OwnershipInferenceResult, "classOwnership" | "ownerCandidates"> {
  const consumerSummaries = buildConsumerSummariesByDefinitionId({
    definitions: input.projectEvidence.entities.classDefinitions,
    definitionConsumers: input.definitionConsumers,
  });
  const stylesheetOwnershipById = new Map(
    input.stylesheetOwnership.map((ownership) => [ownership.stylesheetId, ownership]),
  );
  const componentsById = input.projectEvidence.indexes.componentsById;
  const stylesheetsById = input.projectEvidence.indexes.stylesheetsById;
  const ownerCandidates: StyleOwnerCandidate[] = [];
  const classOwnership: ClassOwnershipEvidence[] = [];

  for (const definition of input.projectEvidence.entities.classDefinitions) {
    const stylesheet = stylesheetsById.get(definition.stylesheetId);
    const consumerSummary =
      consumerSummaries.get(definition.id) ?? emptyConsumerSummary(definition);
    const candidateResult = buildClassOwnerCandidates({
      definition,
      stylesheet,
      consumerSummary,
      importerComponentIds:
        stylesheetOwnershipById.get(definition.stylesheetId)?.importerComponentIds ?? [],
      componentsById,
      includeTraces: input.includeTraces,
    });
    ownerCandidates.push(...candidateResult.ownerCandidates);

    const ownerCandidateIds = candidateResult.ownerCandidates
      .map((candidate) => candidate.id)
      .sort((left, right) => left.localeCompare(right));
    const evidenceKind = getOwnershipEvidenceKind({
      ownerCandidates: candidateResult.ownerCandidates,
      consumerSummary,
    });

    classOwnership.push({
      id: classOwnershipEvidenceId({ classDefinitionId: definition.id }),
      classDefinitionId: definition.id,
      stylesheetId: definition.stylesheetId,
      className: definition.className,
      consumerSummary,
      ownerCandidateIds,
      classificationIds: [],
      evidenceKind,
      compatibilityEvidenceKind: getCompatibilityEvidenceKind({
        evidenceKind,
        ownerCandidates: candidateResult.ownerCandidates,
        consumerSummary,
      }),
      confidence: getOwnershipConfidence(candidateResult.ownerCandidates),
      actable:
        ownerCandidateIds.length > 0 &&
        candidateResult.ownerCandidates.some((candidate) => candidate.actable),
      traces: input.includeTraces
        ? buildClassOwnershipTraces({
            definition,
            stylesheet,
            consumerSummary,
            ownerCandidates: candidateResult.ownerCandidates,
          })
        : [],
    });
  }

  return {
    classOwnership: classOwnership.sort(compareById),
    ownerCandidates: dedupeOwnerCandidates(ownerCandidates),
  };
}

function buildConsumerSummariesByDefinitionId(input: {
  definitions: ClassDefinitionAnalysis[];
  definitionConsumers: ClassDefinitionConsumerEvidence[];
}): Map<string, ClassConsumerSummary> {
  const summaries = new Map(
    input.definitions.map((definition) => [definition.id, emptyConsumerSummary(definition)]),
  );

  for (const consumer of input.definitionConsumers) {
    const summary = summaries.get(consumer.classDefinitionId);
    if (!summary) {
      continue;
    }

    pushUnique(summary.referenceIds, consumer.referenceId);
    if (consumer.matchId) {
      pushUnique(summary.matchIds, consumer.matchId);
    }
    if (consumer.consumingComponentId) {
      pushUnique(summary.consumerComponentIds, consumer.consumingComponentId);
    }
    pushUnique(summary.consumerSourceFileIds, consumer.consumingSourceFileId);
  }

  for (const summary of summaries.values()) {
    summary.consumerComponentIds.sort(compareStrings);
    summary.consumerSourceFileIds.sort(compareStrings);
    summary.referenceIds.sort(compareStrings);
    summary.matchIds.sort(compareStrings);
  }

  return summaries;
}

function emptyConsumerSummary(definition: ClassDefinitionAnalysis): ClassConsumerSummary {
  return {
    classDefinitionId: definition.id,
    className: definition.className,
    consumerComponentIds: [],
    consumerSourceFileIds: [],
    referenceIds: [],
    matchIds: [],
  };
}

function buildClassOwnerCandidates(input: {
  definition: ClassDefinitionAnalysis;
  stylesheet: StylesheetAnalysis | undefined;
  consumerSummary: ClassConsumerSummary;
  importerComponentIds: string[];
  componentsById: Map<string, ComponentAnalysis>;
  includeTraces: boolean;
}): { ownerCandidates: StyleOwnerCandidate[] } {
  const candidatesByComponentId = new Map<string, PendingComponentOwnerCandidate>();

  if (input.importerComponentIds.length === 1) {
    addComponentCandidateReason({
      candidatesByComponentId,
      componentId: input.importerComponentIds[0],
      reason: "single-importing-component",
      confidence: "high",
    });
  }

  if (input.consumerSummary.consumerComponentIds.length === 1) {
    addComponentCandidateReason({
      candidatesByComponentId,
      componentId: input.consumerSummary.consumerComponentIds[0],
      reason: "single-consuming-component",
      confidence: "medium",
    });
  }

  const ownerCandidates: StyleOwnerCandidate[] = [];
  for (const pending of candidatesByComponentId.values()) {
    const component = input.componentsById.get(pending.componentId);
    if (!component) {
      continue;
    }

    const reasons = uniqueSorted([
      ...pending.reasons,
      ...getPathConventionReasons({
        componentFilePath: component.filePath,
        componentName: component.componentName,
        stylesheetFilePath: input.stylesheet?.filePath,
      }),
    ]) as OwnershipCandidateReason[];

    ownerCandidates.push(
      createClassOwnerCandidate({
        definition: input.definition,
        stylesheet: input.stylesheet,
        component,
        reasons,
        confidence: pending.confidence,
        includeTraces: input.includeTraces,
      }),
    );
  }

  if (ownerCandidates.length === 0 && input.consumerSummary.consumerComponentIds.length > 1) {
    ownerCandidates.push({
      id: styleOwnerCandidateId({
        targetKind: "class-definition",
        targetId: input.definition.id,
        ownerKind: "unknown",
        reasonKey: "multi-consumer",
      }),
      targetKind: "class-definition",
      targetId: input.definition.id,
      ownerKind: "unknown",
      confidence: "low",
      actable: false,
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

  return {
    ownerCandidates: ownerCandidates.sort(compareById),
  };
}

type PendingComponentOwnerCandidate = {
  componentId: string;
  reasons: OwnershipCandidateReason[];
  confidence: "low" | "medium" | "high";
};

function addComponentCandidateReason(input: {
  candidatesByComponentId: Map<string, PendingComponentOwnerCandidate>;
  componentId: string;
  reason: OwnershipCandidateReason;
  confidence: "low" | "medium" | "high";
}): void {
  const existing = input.candidatesByComponentId.get(input.componentId);
  if (!existing) {
    input.candidatesByComponentId.set(input.componentId, {
      componentId: input.componentId,
      reasons: [input.reason],
      confidence: input.confidence,
    });
    return;
  }

  existing.reasons = uniqueSorted([
    ...existing.reasons,
    input.reason,
  ]) as OwnershipCandidateReason[];
  existing.confidence = maxConfidence(existing.confidence, input.confidence);
}

function createClassOwnerCandidate(input: {
  definition: ClassDefinitionAnalysis;
  stylesheet: StylesheetAnalysis | undefined;
  component: ComponentAnalysis;
  reasons: OwnershipCandidateReason[];
  confidence: "low" | "medium" | "high";
  includeTraces: boolean;
}): StyleOwnerCandidate {
  return {
    id: styleOwnerCandidateId({
      targetKind: "class-definition",
      targetId: input.definition.id,
      ownerKind: "component",
      ownerId: input.component.id,
      reasonKey: input.reasons.join("|"),
    }),
    targetKind: "class-definition",
    targetId: input.definition.id,
    ownerKind: "component",
    ownerId: input.component.id,
    ownerPath: input.component.filePath,
    confidence: input.confidence,
    actable:
      input.confidence !== "low" &&
      input.reasons.some((reason) =>
        [
          "single-importing-component",
          "single-consuming-component",
          "sibling-basename-convention",
          "component-folder-convention",
        ].includes(reason),
      ),
    reasons: input.reasons,
    traces: input.includeTraces
      ? [
          {
            traceId: `ownership:component-candidate:${input.component.id}:${stableHash(input.reasons.join("|"))}`,
            category: "rule-evaluation",
            summary: `component owner candidate was inferred for class "${input.definition.className}"`,
            anchor: input.component.location,
            children: [],
            metadata: {
              classDefinitionId: input.definition.id,
              componentId: input.component.id,
              componentName: input.component.componentName,
              componentFilePath: input.component.filePath,
              stylesheetFilePath: input.stylesheet?.filePath,
              reasons: input.reasons,
            },
          },
        ]
      : [],
  };
}

function getOwnershipEvidenceKind(input: {
  ownerCandidates: StyleOwnerCandidate[];
  consumerSummary: ClassConsumerSummary;
}): OwnershipEvidenceKind {
  if (
    input.ownerCandidates.some((candidate) =>
      candidate.reasons.includes("single-importing-component"),
    )
  ) {
    return "private-component";
  }
  if (
    input.ownerCandidates.some((candidate) =>
      candidate.reasons.includes("single-consuming-component"),
    )
  ) {
    return "single-consuming-component";
  }
  if (input.consumerSummary.consumerComponentIds.length > 1) {
    return "shared-component-family";
  }
  if (
    input.ownerCandidates.some((candidate) =>
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
    return "private-component";
  }
  return "unresolved";
}

function getCompatibilityEvidenceKind(input: {
  evidenceKind: OwnershipEvidenceKind;
  ownerCandidates: StyleOwnerCandidate[];
  consumerSummary: ClassConsumerSummary;
}): CompatibilityEvidenceKind {
  if (
    input.ownerCandidates.some((candidate) =>
      candidate.reasons.includes("single-importing-component"),
    )
  ) {
    return "single-importing-component";
  }
  if (
    input.ownerCandidates.some((candidate) =>
      candidate.reasons.includes("single-consuming-component"),
    )
  ) {
    return "single-consuming-component";
  }
  if (input.consumerSummary.consumerComponentIds.length > 1) {
    return "multi-consumer";
  }
  if (input.evidenceKind === "private-component") {
    return "path-convention";
  }
  return "unknown";
}

function getOwnershipConfidence(candidates: StyleOwnerCandidate[]): "low" | "medium" | "high" {
  return candidates.reduce(
    (confidence, candidate) => maxConfidence(confidence, candidate.confidence),
    "low" as "low" | "medium" | "high",
  );
}

function buildClassOwnershipTraces(input: {
  definition: ClassDefinitionAnalysis;
  stylesheet: StylesheetAnalysis | undefined;
  consumerSummary: ClassConsumerSummary;
  ownerCandidates: StyleOwnerCandidate[];
}) {
  return [
    {
      traceId: `ownership:class:${input.definition.id}`,
      category: "rule-evaluation" as const,
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

function getPathConventionReasons(input: {
  componentFilePath: string;
  componentName: string;
  stylesheetFilePath?: string;
}): OwnershipCandidateReason[] {
  if (!input.stylesheetFilePath) {
    return [];
  }

  const componentDir = getDirectoryName(input.componentFilePath);
  const stylesheetDir = getDirectoryName(input.stylesheetFilePath);
  const componentBaseName = getBaseNameWithoutExtension(input.componentFilePath);
  const stylesheetBaseName = getBaseNameWithoutExtension(input.stylesheetFilePath);
  const reasons: OwnershipCandidateReason[] = [];

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

  return uniqueSorted(reasons) as OwnershipCandidateReason[];
}

function getFeatureRoot(filePath: string | undefined): string | undefined {
  if (!filePath) {
    return undefined;
  }
  const segments = normalizeProjectPath(filePath).split("/").filter(Boolean);
  const featureIndex = segments.findIndex((segment) => ["features", "feature"].includes(segment));
  if (featureIndex < 0 || featureIndex + 1 >= segments.length) {
    return undefined;
  }
  return segments.slice(0, featureIndex + 2).join("/");
}

function getBaseNameWithoutExtension(filePath: string): string {
  const normalized = normalizeProjectPath(filePath);
  const fileName = normalized.split("/").at(-1) ?? normalized;
  return fileName.replace(/\.[^.]+$/, "");
}

function getDirectoryName(filePath: string): string {
  const parts = normalizeProjectPath(filePath).split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function normalizeProjectPath(filePath: string): string {
  return filePath
    .split("\\")
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

function maxConfidence<T extends "low" | "medium" | "high">(left: T, right: T): T {
  const score = { low: 0, medium: 1, high: 2 };
  return score[right] > score[left] ? right : left;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort(compareStrings);
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function dedupeOwnerCandidates(candidates: StyleOwnerCandidate[]): StyleOwnerCandidate[] {
  const byId = new Map<string, StyleOwnerCandidate>();
  for (const candidate of candidates) {
    byId.set(candidate.id, candidate);
  }
  return [...byId.values()].sort(compareById);
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function compareById(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}
