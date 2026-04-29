import type {
  HtmlScriptSourceFact,
  HtmlStylesheetLinkFact,
  PackageCssImportFact,
} from "../workspace-discovery/types.js";

export type ExternalCssGlobalProviderConfig = {
  provider: string;
  match: string[];
  classPrefixes: string[];
  classNames: string[];
};

export type ExternalCssAnalysisInput = {
  fetchRemote?: boolean;
  globalProviders?: ExternalCssGlobalProviderConfig[];
  htmlStylesheetLinks?: HtmlStylesheetLinkFact[];
  htmlScriptSources?: HtmlScriptSourceFact[];
  packageCssImports?: PackageCssImportFact[];
};

export type ActiveExternalCssProvider = {
  provider: string;
  match: string[];
  classPrefixes: string[];
  classNames: string[];
  matchedStylesheets: HtmlStylesheetLinkFact[];
};

export type ExternalCssSummary = {
  enabled: boolean;
  fetchRemote: boolean;
  activeProviders: ActiveExternalCssProvider[];
  packageCssImports: PackageCssImportFact[];
  projectWideEntrySources: Array<{
    entrySourceFilePath: string;
    appRootPath: string;
  }>;
  projectWideStylesheetFilePaths: string[];
  externalStylesheetFilePaths: string[];
};

export type { HtmlScriptSourceFact, HtmlStylesheetLinkFact, PackageCssImportFact };

// TODO(workspace-discovery): compatibility aliases for direct external-css consumers.
// Prefer the *Fact names and remove these once ExternalCssAnalysisInput is renamed around facts.
export type HtmlScriptSourceInput = HtmlScriptSourceFact;
export type HtmlStylesheetLinkInput = HtmlStylesheetLinkFact;
export type PackageCssImportInput = PackageCssImportFact;
