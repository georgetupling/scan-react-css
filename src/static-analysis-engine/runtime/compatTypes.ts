export type FindingSeverity = "debug" | "info" | "warning" | "error";

export type FindingConfidence = "low" | "medium" | "high";

export type FindingLocation = {
  filePath: string;
  line?: number;
  column?: number;
  context?: string;
};

export type Finding = {
  ruleId: string;
  family: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  message: string;
  primaryLocation?: FindingLocation;
  relatedLocations: FindingLocation[];
  metadata: Record<string, unknown>;
};

export type CompatibilityScanInput = {
  targetPath?: string;
  focusPath?: string;
  configPath?: string;
  cwd?: string;
  outputMinSeverity?: FindingSeverity;
};

export type CompatibilityResolvedConfig = {
  rootDir: string;
  source: {
    include: string[];
    exclude: string[];
    discovery: "auto" | "explicit";
  };
};

export type CompatibilityScanSummary = {
  sourceFileCount: number;
};

export type CompatibilityScanResult = {
  config: CompatibilityResolvedConfig;
  findings: Finding[];
  summary: CompatibilityScanSummary;
};
