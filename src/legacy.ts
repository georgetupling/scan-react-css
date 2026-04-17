import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type LegacyCliModule = {
  runCli: (argv?: string[]) => void;
};

export type AuditOptions = {
  targetDirectory?: string;
  layoutsPath?: string;
  shouldJson?: boolean;
};

export type AuditFinding = {
  className: string;
  ruleId: string;
  severity: "error" | "warning" | "info";
  precedence: number;
  suppresses: string[];
  label: string;
  message: string;
  contexts: Array<{
    filePath: string;
    context: string;
  }>;
  source: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type AggregatedAuditFinding = {
  className: string;
  primary: AuditFinding;
  secondary: AuditFinding[];
  all: AuditFinding[];
};

type LegacyAuditModule = {
  aggregateFindings: (findings: AuditFinding[]) => AggregatedAuditFinding[];
  collectAuditFindings: (audits: {
    layoutAudit: {
      context: { repoRoot: string; targetDirectory: string };
      suggestions: unknown[];
    };
    missingAudit: { results: unknown[] };
    ownershipAudit: { results: unknown[] };
    unusedAudit: { results: unknown[] };
  }) => AuditFinding[];
};

type LegacyRunnerModule<T> = {
  runCli?: (argv?: string[]) => void;
  [key: string]: T | undefined;
};

export function loadMainCli(): LegacyCliModule {
  return require("../css-audit/index.cjs") as LegacyCliModule;
}

export function loadAuditFindingsModule(): LegacyAuditModule {
  return require("../css-audit/findings.cjs") as LegacyAuditModule;
}

export function loadRunnerModule<T>(
  relativePath: string,
): LegacyRunnerModule<T> {
  return require(relativePath) as LegacyRunnerModule<T>;
}
