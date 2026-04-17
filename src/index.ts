import { loadAuditFindingsModule, loadRunnerModule } from "./legacy.js";
import type {
  AggregatedAuditFinding,
  AuditFinding,
  AuditOptions,
} from "./legacy.js";
export type {
  ConfidenceLevel,
  ExternalCssMode,
  OwnershipNamingConvention,
  RawReactCssScannerConfig,
  ResolvedReactCssScannerConfig,
  RuleConfigValue,
  RuleSeverity,
} from "./config/types.js";
export { DEFAULT_CONFIG } from "./config/types.js";

type LayoutAuditResult = {
  context: { repoRoot: string; targetDirectory: string };
  suggestions: unknown[];
};

type ResultAudit = {
  context?: unknown;
  results: unknown[];
};

const { aggregateFindings, collectAuditFindings } = loadAuditFindingsModule();

const { runLayoutReplacementAudit } = loadRunnerModule<
  (options?: AuditOptions) => LayoutAuditResult
>("../css-audit/layout-replacements.cjs");

const { runMissingCssClassAudit } = loadRunnerModule<
  (options?: AuditOptions) => ResultAudit
>("../css-audit/missing-css-classes.cjs");

const { runOwnershipAudit } = loadRunnerModule<
  (options?: AuditOptions) => ResultAudit
>("../css-audit/ownership.cjs");

const { runUnusedCssAudit } = loadRunnerModule<
  (options?: AuditOptions) => ResultAudit
>("../css-audit/unused-css-classes.cjs");

export type {
  AggregatedAuditFinding,
  AuditFinding,
  AuditOptions,
} from "./legacy.js";

export function scanReactCss(
  options: AuditOptions = {},
): AggregatedAuditFinding[] {
  const layoutAudit = runLayoutReplacementAudit?.(options);
  const missingAudit = runMissingCssClassAudit?.(options);
  const ownershipAudit = runOwnershipAudit?.(options);
  const unusedAudit = runUnusedCssAudit?.(options);

  if (!layoutAudit || !missingAudit || !ownershipAudit || !unusedAudit) {
    throw new Error("Legacy audit modules could not be loaded.");
  }

  const findings = collectAuditFindings({
    layoutAudit,
    missingAudit,
    ownershipAudit,
    unusedAudit,
  }) as AuditFinding[];

  return aggregateFindings(findings);
}

export const scan = scanReactCss;
