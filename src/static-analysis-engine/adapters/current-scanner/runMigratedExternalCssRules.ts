import { analyzeProjectModelWithStaticEngine } from "./analyzeProjectModelWithStaticEngine.js";
import type { ExperimentalRuleResult } from "../../pipeline/rule-execution/types.js";
import type { ProjectModel } from "../../../model/types.js";
import { sortFindings } from "../../../runtime/findings.js";
import type { Finding, FindingSeverity } from "../../../runtime/types.js";
import type { ClassReferenceFact } from "../../../facts/types.js";
import type { RuleContext } from "../../../rules/types.js";

const MIGRATED_RULE_ID = "missing-external-css-class";
const DEFAULT_RUNTIME_SEVERITY: FindingSeverity = "error";

const migratedExternalCssRuleCache = new WeakMap<ProjectModel, Finding[]>();

export function getMigratedExternalCssRuleFindings(
  context: Pick<RuleContext, "model" | "createFinding" | "getRuleSeverity">,
): Finding[] {
  const cachedFindings = migratedExternalCssRuleCache.get(context.model);
  if (cachedFindings) {
    return cachedFindings;
  }

  const findings = buildMigratedExternalCssRuleFindings(context);
  migratedExternalCssRuleCache.set(context.model, findings);
  return findings;
}

function buildMigratedExternalCssRuleFindings(
  context: Pick<RuleContext, "model" | "createFinding" | "getRuleSeverity">,
): Finding[] {
  const severity = context.getRuleSeverity(MIGRATED_RULE_ID, DEFAULT_RUNTIME_SEVERITY);
  if (severity === "off" || context.model.facts.sourceFacts.length === 0) {
    return [];
  }

  const engineResult = analyzeProjectModelWithStaticEngine(context.model, {
    includeExternalCssSources: true,
  });
  const findings: Finding[] = [];

  for (const ruleResult of engineResult.experimentalRuleResults) {
    if (ruleResult.ruleId !== MIGRATED_RULE_ID) {
      continue;
    }

    findings.push(toMigratedFinding(context, ruleResult, severity));
  }

  return sortFindings(findings);
}

function toMigratedFinding(
  context: Pick<RuleContext, "model" | "createFinding">,
  ruleResult: ExperimentalRuleResult,
  severity: FindingSeverity,
): Finding {
  const sourceFilePath =
    toOptionalString(ruleResult.metadata?.sourceFilePath) ?? ruleResult.primaryLocation?.filePath;
  const className =
    toOptionalString(ruleResult.metadata?.className) ?? extractClassName(ruleResult.summary);
  const externalCssSpecifiers = toStringArray(ruleResult.metadata?.externalStylesheetPaths);
  const reference = findMatchingReference(context.model, {
    sourceFilePath,
    className,
    line: ruleResult.primaryLocation?.line,
    column: getAnchorStartColumn(ruleResult),
  });

  return context.createFinding({
    ruleId: MIGRATED_RULE_ID,
    family: "external-css",
    severity,
    confidence: reference?.confidence ?? ruleResult.confidence,
    message: ruleResult.summary,
    primaryLocation: sourceFilePath
      ? {
          filePath: sourceFilePath,
          line: ruleResult.primaryLocation?.line,
          column: reference?.column ?? getAnchorStartColumn(ruleResult),
        }
      : undefined,
    relatedLocations: externalCssSpecifiers.map((specifier) => ({ filePath: specifier })),
    subject: {
      className,
      sourceFilePath,
    },
    metadata: {
      externalCssSpecifiers,
      ...(reference ? { referenceKind: reference.kind } : {}),
    },
  });
}

function findMatchingReference(
  model: ProjectModel,
  input: {
    sourceFilePath?: string;
    className?: string;
    line?: number;
    column?: number;
  },
): ClassReferenceFact | undefined {
  if (!input.sourceFilePath || !input.className) {
    return undefined;
  }

  const references =
    model.indexes.classReferencesByName
      .get(input.className)
      ?.filter((entry) => entry.sourceFile === input.sourceFilePath) ?? [];
  if (references.length === 0) {
    return undefined;
  }

  const exactMatch = references.find(
    (entry) =>
      (input.line === undefined || entry.reference.line === input.line) &&
      (input.column === undefined || entry.reference.column === input.column),
  );
  if (exactMatch) {
    return exactMatch.reference;
  }

  const lineMatch = references.find(
    (entry) => input.line === undefined || entry.reference.line === input.line,
  );
  if (lineMatch) {
    return lineMatch.reference;
  }

  return references[0]?.reference;
}

function getAnchorStartColumn(ruleResult: ExperimentalRuleResult): number | undefined {
  for (const trace of ruleResult.traces) {
    if (trace.anchor?.startColumn !== undefined) {
      return trace.anchor.startColumn;
    }
  }

  return undefined;
}

function extractClassName(summary: string): string | undefined {
  const match = summary.match(/Class "([^"]+)"/);
  return match?.[1];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .slice()
    .sort((left, right) => left.localeCompare(right));
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
