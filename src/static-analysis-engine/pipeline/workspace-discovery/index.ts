export { buildProjectSnapshot } from "./buildProjectSnapshot.js";
export { discoverProjectFileRecords } from "./files/discoverProjectFileRecords.js";

export type {
  HtmlScriptEdge,
  HtmlScriptSourceFact,
  HtmlScriptSourceInput,
  HtmlStylesheetEdge,
  HtmlStylesheetLinkFact,
  HtmlStylesheetLinkInput,
  PackageCssImportEdge,
  PackageCssImportFact,
  PackageCssImportInput,
  ProjectBoundary,
  ProjectConfigFile,
  ProjectExternalCssSurface,
  ProjectFileDiscoveryResult,
  ProjectHtmlFile,
  ProjectResourceEdge,
  ProjectSnapshot,
  ProjectSnapshotFiles,
  ProjectSourceFile,
  ProjectStylesheetFile,
  SourceImportEdge,
  SourceImportFact,
  SourceImportKind,
  StylesheetImportEdge,
  StylesheetImportFact,
} from "./types.js";
