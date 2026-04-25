import type { AnalysisTrace } from "../../types/analysis.js";
import type { SourceAnchor } from "../../types/core.js";

export type CssModuleLocalsConvention = "asIs" | "camelCase" | "camelCaseOnly";

export type CssModuleAnalysisOptions = {
  localsConvention?: CssModuleLocalsConvention;
};

export type CssModuleImportRecord = {
  sourceFilePath: string;
  stylesheetFilePath: string;
  specifier: string;
  localName: string;
  importKind: "default" | "namespace" | "named";
};

export type CssModuleMemberReferenceRecord = {
  sourceFilePath: string;
  stylesheetFilePath: string;
  localName: string;
  memberName: string;
  accessKind: "property" | "string-literal-element";
  location: SourceAnchor;
  rawExpressionText: string;
  traces: AnalysisTrace[];
};

export type CssModuleReferenceDiagnosticRecord = {
  sourceFilePath: string;
  stylesheetFilePath: string;
  localName: string;
  reason: "computed-css-module-member";
  location: SourceAnchor;
  rawExpressionText: string;
  traces: AnalysisTrace[];
};

export type CssModuleAnalysis = {
  options: Required<CssModuleAnalysisOptions>;
  imports: CssModuleImportRecord[];
  memberReferences: CssModuleMemberReferenceRecord[];
  diagnostics: CssModuleReferenceDiagnosticRecord[];
};
