import type { ProjectAnalysis } from "../static-analysis-engine/index.js";
import type { Finding } from "../rules/index.js";
import type { ResolvedScannerConfig } from "../config/index.js";

export type ScanProjectInput = {
  rootDir?: string;
  sourceFilePaths?: string[];
  cssFilePaths?: string[];
  configPath?: string;
};

export type ScanDiagnosticSeverity = "info" | "warning" | "error";

export type ScanDiagnosticPhase = "config" | "discovery" | "loading" | "analysis";

export type ScanDiagnostic = {
  code: string;
  severity: ScanDiagnosticSeverity;
  message: string;
  phase: ScanDiagnosticPhase;
  filePath?: string;
};

export type ProjectFileRecord = {
  filePath: string;
  absolutePath: string;
};

export type ProjectDiscoveryResult = {
  rootDir: string;
  sourceFiles: ProjectFileRecord[];
  cssFiles: ProjectFileRecord[];
  diagnostics: ScanDiagnostic[];
};

export type ScanProjectResult = {
  rootDir: string;
  config: ResolvedScannerConfig;
  analysis: ProjectAnalysis;
  findings: Finding[];
  diagnostics: ScanDiagnostic[];
  failed: boolean;
  files: {
    sourceFiles: ProjectFileRecord[];
    cssFiles: ProjectFileRecord[];
  };
};
