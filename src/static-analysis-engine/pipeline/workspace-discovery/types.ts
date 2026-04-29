import type { ResolvedScannerConfig } from "../../../config/index.js";
import type { ProjectFileRecord, ScanDiagnostic } from "../../../project/types.js";
import type {
  ExternalCssAnalysisInput,
  HtmlScriptSourceInput,
  HtmlStylesheetLinkInput,
  PackageCssImportInput,
} from "../external-css/types.js";
import type { SelectorSourceInput } from "../selector-analysis/types.js";

export type ProjectSnapshotStageRunner = <T>(
  stage: string,
  message: string,
  run: () => T | Promise<T>,
) => Promise<T>;

export type ProjectSnapshot = {
  rootDir: string;
  config: ResolvedScannerConfig;
  files: ProjectSnapshotFiles;
  discoveredFiles: {
    sourceFiles: ProjectFileRecord[];
    cssFiles: ProjectFileRecord[];
    htmlFiles: ProjectFileRecord[];
  };
  boundaries: ProjectBoundary[];
  edges: ProjectResourceEdge[];
  externalCss: ProjectExternalCssSurface;
  diagnostics: ScanDiagnostic[];
};

export type ProjectSnapshotFiles = {
  sourceFiles: ProjectSourceFile[];
  stylesheets: ProjectStylesheetFile[];
  htmlFiles: ProjectHtmlFile[];
  configFiles: ProjectConfigFile[];
};

export type ProjectSourceFile = {
  kind: "source";
  filePath: string;
  absolutePath: string;
  sourceText: string;
};

export type ProjectStylesheetFile = {
  kind: "stylesheet";
  filePath: string;
  absolutePath?: string;
  cssText: string;
  cssKind: "global-css" | "css-module";
  origin: "project" | "html-linked" | "package" | "remote";
};

export type ProjectHtmlFile = {
  kind: "html";
  filePath: string;
  absolutePath: string;
  htmlText: string;
};

export type ProjectConfigFile = {
  kind: "config";
  source: ResolvedScannerConfig["source"];
  filePath?: string;
};

export type ProjectBoundary =
  | {
      kind: "scan-root";
      rootDir: string;
    }
  | {
      kind: "source-root";
      filePath: string;
      source: "config";
    }
  | {
      kind: "html-app-entry";
      htmlFilePath: string;
      entrySourceFilePath: string;
      appRootPath: string;
    };

export type ProjectResourceEdge = HtmlStylesheetEdge | HtmlScriptEdge | PackageCssImportEdge;

export type HtmlStylesheetEdge = {
  kind: "html-stylesheet";
  fromHtmlFilePath: string;
  href: string;
  isRemote: boolean;
  resolvedFilePath?: string;
};

export type HtmlScriptEdge = {
  kind: "html-script";
  fromHtmlFilePath: string;
  src: string;
  resolvedFilePath?: string;
  appRootPath?: string;
};

export type PackageCssImportEdge = {
  kind: "package-css-import";
  importerKind: "source" | "stylesheet";
  importerFilePath: string;
  specifier: string;
  resolvedFilePath: string;
};

export type ProjectExternalCssSurface = {
  fetchRemote: boolean;
  globalProviders: ResolvedScannerConfig["externalCss"]["globals"];
  htmlStylesheetLinks: HtmlStylesheetLinkInput[];
  htmlScriptSources: HtmlScriptSourceInput[];
  packageCssImports: PackageCssImportInput[];
};

export type ProjectSnapshotEngineInput = {
  sourceFiles: Array<{ filePath: string; sourceText: string }>;
  projectRoot: string;
  selectorCssSources: SelectorSourceInput[];
  cssModules: ResolvedScannerConfig["cssModules"];
  externalCss: ExternalCssAnalysisInput;
};
