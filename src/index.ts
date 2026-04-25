export { analyzeProject, discoverProjectFiles, scanProject } from "./project/index.js";
export { RULE_DEFINITIONS, runRules } from "./rules/index.js";
export { DEFAULT_SCANNER_CONFIG, loadScannerConfig } from "./config/index.js";
export type {
  ProjectDiscoveryResult,
  ProjectFileRecord,
  ScanDiagnostic,
  ScanDiagnosticPhase,
  ScanDiagnosticSeverity,
  ScanProjectInput,
  ScanProjectResult,
} from "./project/index.js";
export type {
  AnalysisEntityRef,
  Finding,
  RuleDefinition,
  RuleEngineResult,
  RuleId,
  RuleSeverity,
} from "./rules/index.js";
export type { ResolvedScannerConfig, RuleConfigSeverity, ScannerConfig } from "./config/index.js";

export type {
  ProjectAnalysis,
  ProjectAnalysisEntities,
  ProjectAnalysisIndexes,
  ProjectAnalysisInputs,
  ProjectAnalysisMeta,
  ProjectAnalysisRelations,
} from "./static-analysis-engine/index.js";
