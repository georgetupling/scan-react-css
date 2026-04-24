import { analyzeProjectModelWithStaticEngine } from "./analyzeProjectModelWithStaticEngine.js";
import type { ExperimentalRuleResult } from "../../pipeline/rule-execution/types.js";
import type { ProjectModel } from "../../../model/types.js";
import { sortFindings } from "../../../runtime/findings.js";
import type { Finding, FindingLocation, FindingSeverity } from "../../../runtime/types.js";
import type { RuleContext } from "../../../rules/types.js";

const MIGRATED_RULE_IDS = [
  "duplicate-css-class-definition",
  "empty-css-rule",
  "redundant-css-declaration-block",
  "unused-compound-selector-branch",
] as const;

type MigratedOptimizationRuleId = (typeof MIGRATED_RULE_IDS)[number];

const DEFAULT_RUNTIME_SEVERITIES: Record<MigratedOptimizationRuleId, FindingSeverity> = {
  "duplicate-css-class-definition": "warning",
  "empty-css-rule": "info",
  "redundant-css-declaration-block": "info",
  "unused-compound-selector-branch": "info",
};

const migratedOptimizationRuleCache = new WeakMap<
  ProjectModel,
  Map<MigratedOptimizationRuleId, Finding[]>
>();

export function getMigratedOptimizationRuleFindings(
  context: Pick<RuleContext, "model" | "createFinding" | "getRuleSeverity">,
  ruleId: MigratedOptimizationRuleId,
): Finding[] {
  const cachedFindings = migratedOptimizationRuleCache.get(context.model);
  if (cachedFindings) {
    return cachedFindings.get(ruleId) ?? [];
  }

  const findingsByRuleId = buildMigratedOptimizationRuleFindings(context);
  migratedOptimizationRuleCache.set(context.model, findingsByRuleId);
  return findingsByRuleId.get(ruleId) ?? [];
}

function buildMigratedOptimizationRuleFindings(
  context: Pick<RuleContext, "model" | "createFinding" | "getRuleSeverity">,
): Map<MigratedOptimizationRuleId, Finding[]> {
  const findingsByRuleId = new Map<MigratedOptimizationRuleId, Finding[]>(
    MIGRATED_RULE_IDS.map((ruleId) => [ruleId, []]),
  );
  if (context.model.facts.sourceFacts.length === 0 && context.model.facts.cssFacts.length === 0) {
    return findingsByRuleId;
  }

  const engineResult = analyzeProjectModelWithStaticEngine(context.model);

  for (const ruleResult of engineResult.experimentalRuleResults) {
    if (!isMigratedOptimizationRuleId(ruleResult.ruleId)) {
      continue;
    }

    if (
      ruleResult.ruleId === "unused-compound-selector-branch" &&
      isCssModuleFile(ruleResult.primaryLocation?.filePath)
    ) {
      continue;
    }

    const severity = context.getRuleSeverity(
      ruleResult.ruleId,
      DEFAULT_RUNTIME_SEVERITIES[ruleResult.ruleId],
    );
    if (severity === "off") {
      continue;
    }

    findingsByRuleId
      .get(ruleResult.ruleId)
      ?.push(...toMigratedFindings(context, ruleResult, severity));
  }

  for (const [ruleId, findings] of findingsByRuleId.entries()) {
    findingsByRuleId.set(ruleId, sortFindings(findings));
  }

  return findingsByRuleId;
}

function toMigratedFindings(
  context: Pick<RuleContext, "createFinding">,
  ruleResult: ExperimentalRuleResult,
  severity: FindingSeverity,
): Finding[] {
  switch (ruleResult.ruleId) {
    case "empty-css-rule":
      return [
        context.createFinding({
          ruleId: "empty-css-rule",
          family: "optimization-and-migration",
          severity,
          confidence: ruleResult.confidence,
          message: ruleResult.summary,
          primaryLocation: toPrimaryLocation(ruleResult),
          subject: {
            cssFilePath: ruleResult.primaryLocation?.filePath,
          },
          metadata: {
            selector:
              toOptionalString(ruleResult.metadata?.selector) ?? ruleResult.selectorText ?? "",
            atRuleContext: toAtRuleContextMetadata(ruleResult.metadata?.atRuleContext),
          },
        }),
      ];
    case "duplicate-css-class-definition": {
      const duplicateLocations = toDuplicateLocations(ruleResult.metadata?.duplicateLocations);
      const className =
        toOptionalString(ruleResult.metadata?.className) ?? extractClassName(ruleResult);
      const primaryLocation = toPrimaryLocation(ruleResult);

      return [
        context.createFinding({
          ruleId: "duplicate-css-class-definition",
          family: "optimization-and-migration",
          severity,
          confidence: ruleResult.confidence,
          message: ruleResult.summary,
          primaryLocation,
          relatedLocations: toRelatedLocations(duplicateLocations),
          subject: {
            className,
            cssFilePath: primaryLocation?.filePath,
          },
          metadata: {
            duplicateCssFiles: toStringArray(ruleResult.metadata?.duplicateCssFiles),
            atRuleContextSignature:
              toOptionalString(ruleResult.metadata?.atRuleContextSignature) ?? "",
            duplicateLocations,
          },
        }),
      ];
    }
    case "redundant-css-declaration-block": {
      const duplicateLocations = toDuplicateLocations(ruleResult.metadata?.duplicateLocations);
      const className =
        toOptionalString(ruleResult.metadata?.className) ?? extractClassName(ruleResult);
      const primaryLocation = toPrimaryLocation(ruleResult);

      return [
        context.createFinding({
          ruleId: "redundant-css-declaration-block",
          family: "optimization-and-migration",
          severity,
          confidence: ruleResult.confidence,
          message: ruleResult.summary,
          primaryLocation,
          relatedLocations: toRelatedLocations(duplicateLocations),
          subject: {
            className,
            cssFilePath: primaryLocation?.filePath,
          },
          metadata: {
            selector:
              toOptionalString(ruleResult.metadata?.selector) ?? ruleResult.selectorText ?? "",
            declarationSignature: toOptionalString(ruleResult.metadata?.declarationSignature) ?? "",
            atRuleContextSignature:
              toOptionalString(ruleResult.metadata?.atRuleContextSignature) ?? "",
            duplicateLocations,
          },
        }),
      ];
    }
    case "unused-compound-selector-branch": {
      const requiredClassNames = toRequiredClassNames(ruleResult);
      const primaryLocation = toPrimaryLocation(ruleResult);
      const subjectClassNames = requiredClassNames.length > 0 ? requiredClassNames : [undefined];

      return subjectClassNames.map((className) =>
        context.createFinding({
          ruleId: "unused-compound-selector-branch",
          family: "optimization-and-migration",
          severity,
          confidence: ruleResult.confidence,
          message: ruleResult.summary,
          primaryLocation,
          subject: {
            className,
            cssFilePath: primaryLocation?.filePath,
          },
          metadata: {
            selector: ruleResult.selectorText ?? "",
            requiredClassNames,
            atRuleContext: toRuleResultAtRuleContext(ruleResult),
          },
        }),
      );
    }
  }

  return [];
}

function toPrimaryLocation(ruleResult: ExperimentalRuleResult): FindingLocation | undefined {
  if (!ruleResult.primaryLocation?.filePath) {
    return undefined;
  }

  return {
    filePath: ruleResult.primaryLocation.filePath,
    line: ruleResult.primaryLocation.line,
  };
}

function toRelatedLocations(duplicateLocations: DuplicateLocation[]): FindingLocation[] {
  return duplicateLocations.slice(1).flatMap((location) => {
    if (!location.filePath) {
      return [];
    }

    return [
      {
        filePath: location.filePath,
        line: location.line,
      },
    ];
  });
}

function toRequiredClassNames(ruleResult: ExperimentalRuleResult): string[] {
  const metadataClassNames = toOrderedStringArray(ruleResult.metadata?.requiredClassNames);
  if (metadataClassNames.length > 0) {
    return metadataClassNames;
  }

  if (
    ruleResult.selectorQueryResult?.constraint?.kind === "same-node-class-conjunction" &&
    Array.isArray(ruleResult.selectorQueryResult.constraint.classNames)
  ) {
    return [...ruleResult.selectorQueryResult.constraint.classNames];
  }

  return [];
}

function toRuleResultAtRuleContext(ruleResult: ExperimentalRuleResult): AtRuleContextMetadata[] {
  const metadataAtRuleContext = toAtRuleContextMetadata(ruleResult.metadata?.atRuleContext);
  if (metadataAtRuleContext.length > 0) {
    return metadataAtRuleContext;
  }

  if (ruleResult.selectorQueryResult?.source.kind !== "css-source") {
    return [];
  }

  return (ruleResult.selectorQueryResult.source.atRuleContext ?? []).map((entry) => ({
    name: entry.kind,
    params: entry.queryText,
  }));
}

function extractClassName(ruleResult: ExperimentalRuleResult): string | undefined {
  const match = ruleResult.summary.match(/Class "([^"]+)"/);
  return match?.[1];
}

function isMigratedOptimizationRuleId(ruleId: string): ruleId is MigratedOptimizationRuleId {
  return MIGRATED_RULE_IDS.includes(ruleId as MigratedOptimizationRuleId);
}

function isCssModuleFile(filePath: string | undefined): boolean {
  return filePath ? /\.module\.[^.]+$/i.test(filePath) : false;
}

type AtRuleContextMetadata = {
  name: string;
  params: string;
};

type DuplicateLocation = {
  filePath?: string;
  line?: number;
  selector?: string;
  atRuleContext?: AtRuleContextMetadata[];
};

function toDuplicateLocations(value: unknown): DuplicateLocation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    return [
      {
        filePath: toOptionalString((entry as Record<string, unknown>).filePath),
        line: toOptionalNumber((entry as Record<string, unknown>).line),
        selector: toOptionalString((entry as Record<string, unknown>).selector),
        atRuleContext: toAtRuleContextMetadata((entry as Record<string, unknown>).atRuleContext),
      },
    ];
  });
}

function toAtRuleContextMetadata(value: unknown): AtRuleContextMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const name = toOptionalString((entry as Record<string, unknown>).name);
    const params = toOptionalString((entry as Record<string, unknown>).params);
    if (!name) {
      return [];
    }

    return [
      {
        name,
        params: params ?? "",
      },
    ];
  });
}

function toStringArray(value: unknown): string[] {
  return toOrderedStringArray(value)
    .slice()
    .sort((left, right) => left.localeCompare(right));
}

function toOrderedStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
