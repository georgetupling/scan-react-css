import type { ResolvedScannerConfig } from "../../../config/index.js";
import { loadScannerConfig } from "../../../config/index.js";
import { resolveRootDir } from "../../../project/pathUtils.js";
import type { ScanDiagnostic, ScanProjectInput } from "../../../project/types.js";
import { collectProjectBoundaries } from "./boundaries/collectProjectBoundaries.js";
import { collectProjectResourceEdges } from "./edges/collectResourceEdges.js";
import { discoverProjectFileRecords } from "./files/discoverProjectFileRecords.js";
import { readCssFiles, readHtmlFiles, readSourceFiles } from "./files/readProjectFileContents.js";
import { mergeStylesheets, toCssSources, toStylesheetFiles } from "./files/stylesheetInventory.js";
import { collectHtmlResources } from "./html/htmlLinks.js";
import { collectLinkedCssFiles } from "./html/htmlPathResolution.js";
import { loadPackageCssImports } from "./packages/loadPackageCssImports.js";
import { fetchRemoteCssSources } from "./remote/fetchRemoteCssSources.js";
import { collectSourceImports } from "./source/collectSourceImports.js";
import { collectStylesheetImports } from "./stylesheets/collectStylesheetImports.js";
import type { ProjectConfigFile, ProjectSnapshot } from "./types.js";

export async function buildProjectSnapshot(input: {
  scanInput: ScanProjectInput;
  rootDir?: string;
}): Promise<ProjectSnapshot> {
  const rootDir = resolveRootDir(input.rootDir ?? input.scanInput.rootDir);
  const diagnostics: ScanDiagnostic[] = [];
  const config = await loadScannerConfig({
    rootDir,
    configBaseDir: input.scanInput.configBaseDir,
    configPath: input.scanInput.configPath,
    diagnostics,
  });
  const discovered = await discoverProjectFileRecords({
    ...input.scanInput,
    rootDir,
    discovery: config.discovery,
  });
  diagnostics.push(...discovered.diagnostics);

  const [sourceFiles, cssFiles, htmlFiles] = await Promise.all([
    readSourceFiles(discovered.sourceFiles, diagnostics),
    readCssFiles(discovered.cssFiles, diagnostics, "project"),
    readHtmlFiles(discovered.htmlFiles, diagnostics),
  ]);
  const { htmlStylesheetLinks, htmlScriptSources } = collectHtmlResources({
    rootDir: discovered.rootDir,
    htmlFiles,
    diagnostics,
  });
  const linkedCssFiles = await readCssFiles(
    collectLinkedCssFiles({
      rootDir: discovered.rootDir,
      cssFiles: discovered.cssFiles,
      htmlStylesheetLinks,
    }),
    diagnostics,
    "html-linked",
  );
  const packageCssImports = await loadPackageCssImports({
    rootDir: discovered.rootDir,
    sourceFiles,
    cssSources: toCssSources([...cssFiles, ...linkedCssFiles]),
    diagnostics,
  });
  const packageStylesheets = toStylesheetFiles(packageCssImports.cssSources, "package");
  const remoteCssSources = config.externalCss.fetchRemote
    ? await fetchRemoteCssSources({
        htmlStylesheetLinks,
        remoteTimeoutMs: config.externalCss.remoteTimeoutMs,
        diagnostics,
      })
    : [];
  const remoteStylesheets = toStylesheetFiles(remoteCssSources, "remote");
  const stylesheets = mergeStylesheets([
    ...cssFiles,
    ...linkedCssFiles,
    ...packageStylesheets,
    ...remoteStylesheets,
  ]);
  const stylesheetImports = collectStylesheetImports({
    stylesheets,
  });
  const sourceImports = collectSourceImports({
    sourceFiles,
    stylesheets,
  });

  return {
    rootDir: discovered.rootDir,
    config,
    files: {
      sourceFiles,
      stylesheets,
      htmlFiles,
      configFiles: collectConfigFiles(config),
    },
    discoveredFiles: {
      sourceFiles: discovered.sourceFiles,
      cssFiles: discovered.cssFiles,
      htmlFiles: discovered.htmlFiles,
    },
    boundaries: collectProjectBoundaries({
      rootDir: discovered.rootDir,
      config,
      htmlScriptSources,
      sourceFiles,
    }),
    edges: collectProjectResourceEdges({
      htmlStylesheetLinks,
      htmlScriptSources,
      packageCssImports: packageCssImports.imports,
      stylesheetImports,
      sourceImports,
    }),
    externalCss: {
      fetchRemote: config.externalCss.fetchRemote,
      globalProviders: config.externalCss.globals,
    },
    diagnostics,
  };
}

function collectConfigFiles(config: ResolvedScannerConfig): ProjectConfigFile[] {
  return [
    {
      kind: "config",
      source: config.source,
      ...("path" in config.source ? { filePath: config.source.path } : {}),
    },
  ];
}
