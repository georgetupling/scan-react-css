import { readFile } from "node:fs/promises";
import { loadScannerConfig } from "../config/index.js";
import { runRules } from "../rules/index.js";
import { severityMeetsThreshold } from "../rules/severity.js";
import { analyzeProjectSourceTexts } from "../static-analysis-engine/index.js";
import { discoverProjectFiles } from "./discovery.js";
import type {
  ProjectFileRecord,
  ScanDiagnostic,
  ScanProjectInput,
  ScanProjectResult,
} from "./types.js";

export async function scanProject(input: ScanProjectInput = {}): Promise<ScanProjectResult> {
  const discovered = await discoverProjectFiles(input);
  const diagnostics: ScanDiagnostic[] = [...discovered.diagnostics];
  const config = await loadScannerConfig({
    rootDir: discovered.rootDir,
    configPath: input.configPath,
    diagnostics,
  });
  const [sourceFiles, cssFiles] = await Promise.all([
    readSourceFiles(discovered.sourceFiles, diagnostics),
    readCssFiles(discovered.cssFiles, diagnostics),
  ]);

  const engineResult = analyzeProjectSourceTexts({
    sourceFiles,
    selectorCssSources: cssFiles,
  });
  const ruleResult = runRules({
    analysis: engineResult.projectAnalysis,
    config,
  });
  const failed =
    diagnostics.some((diagnostic) => diagnostic.severity === "error") ||
    ruleResult.findings.some((finding) =>
      severityMeetsThreshold(finding.severity, config.failOnSeverity),
    );

  return {
    rootDir: discovered.rootDir,
    config,
    analysis: engineResult.projectAnalysis,
    findings: ruleResult.findings,
    diagnostics,
    failed,
    files: {
      sourceFiles: discovered.sourceFiles,
      cssFiles: discovered.cssFiles,
    },
  };
}

export const analyzeProject = scanProject;

async function readSourceFiles(
  sourceFiles: ProjectFileRecord[],
  diagnostics: ScanDiagnostic[],
): Promise<Array<{ filePath: string; sourceText: string }>> {
  const loadedFiles = await Promise.all(
    sourceFiles.map(async (sourceFile) => {
      const content = await readProjectFile(sourceFile, diagnostics);
      return content
        ? {
            filePath: sourceFile.filePath,
            sourceText: content,
          }
        : undefined;
    }),
  );

  return loadedFiles.filter((file): file is { filePath: string; sourceText: string } =>
    Boolean(file),
  );
}

async function readCssFiles(
  cssFiles: ProjectFileRecord[],
  diagnostics: ScanDiagnostic[],
): Promise<Array<{ filePath: string; cssText: string }>> {
  const loadedFiles = await Promise.all(
    cssFiles.map(async (cssFile) => {
      const content = await readProjectFile(cssFile, diagnostics);
      return content
        ? {
            filePath: cssFile.filePath,
            cssText: content,
          }
        : undefined;
    }),
  );

  return loadedFiles.filter((file): file is { filePath: string; cssText: string } => Boolean(file));
}

async function readProjectFile(
  file: ProjectFileRecord,
  diagnostics: ScanDiagnostic[],
): Promise<string | undefined> {
  try {
    return await readFile(file.absolutePath, "utf8");
  } catch (error) {
    diagnostics.push({
      code: "loading.file-read-failed",
      severity: "error",
      phase: "loading",
      filePath: file.filePath,
      message: `failed to read ${file.filePath}: ${error instanceof Error ? error.message : String(error)}`,
    });
    return undefined;
  }
}
