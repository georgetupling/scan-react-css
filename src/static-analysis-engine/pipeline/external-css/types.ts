export type ExternalCssMode = "imported-only" | "declared-globals" | "fetch-remote";

export type ExternalCssGlobalProviderConfig = {
  provider: string;
  match: string[];
  classPrefixes: string[];
  classNames: string[];
};

export type HtmlStylesheetLinkInput = {
  filePath: string;
  href: string;
  isRemote: boolean;
};

export type ExternalCssAnalysisInput = {
  enabled?: boolean;
  mode?: ExternalCssMode;
  globalProviders?: ExternalCssGlobalProviderConfig[];
  htmlStylesheetLinks?: HtmlStylesheetLinkInput[];
};

export type ActiveExternalCssProvider = {
  provider: string;
  match: string[];
  classPrefixes: string[];
  classNames: string[];
  matchedStylesheets: HtmlStylesheetLinkInput[];
};

export type ExternalCssSummary = {
  enabled: boolean;
  mode: ExternalCssMode;
  activeProviders: ActiveExternalCssProvider[];
  projectWideStylesheetFilePaths: string[];
};
