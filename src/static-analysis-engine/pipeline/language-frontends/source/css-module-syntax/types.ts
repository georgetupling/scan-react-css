import type { AnalysisTrace } from "../../../../types/analysis.js";
import type { SourceAnchor } from "../../../../types/core.js";

export type ResolvedCssModuleImportKind = "default" | "namespace" | "named";

export type ResolvedCssModuleNamespaceBinding = {
  sourceFilePath: string;
  stylesheetFilePath: string;
  specifier: string;
  localName: string;
  originLocalName: string;
  importKind: ResolvedCssModuleImportKind;
  sourceKind: "direct-import" | "alias";
  location: SourceAnchor;
  rawExpressionText: string;
  traces: AnalysisTrace[];
};

export type ResolvedCssModuleMemberReference = {
  sourceFilePath: string;
  stylesheetFilePath: string;
  specifier: string;
  localName: string;
  originLocalName: string;
  memberName: string;
  accessKind: "property" | "string-literal-element" | "destructured-binding";
  location: SourceAnchor;
  rawExpressionText: string;
  traces: AnalysisTrace[];
};

export type ResolvedCssModuleMemberBinding = {
  sourceFilePath: string;
  stylesheetFilePath: string;
  specifier: string;
  localName: string;
  originLocalName: string;
  memberName: string;
  sourceKind: "destructured-binding";
  location: SourceAnchor;
  rawExpressionText: string;
  traces: AnalysisTrace[];
};

export type ResolvedCssModuleBindingDiagnosticReason =
  | "computed-css-module-member"
  | "computed-css-module-destructuring"
  | "nested-css-module-destructuring"
  | "rest-css-module-destructuring"
  | "self-referential-css-module-alias"
  | "reassignable-css-module-alias";

export type ResolvedCssModuleBindingDiagnostic = {
  sourceFilePath: string;
  stylesheetFilePath: string;
  specifier: string;
  localName: string;
  originLocalName: string;
  reason: ResolvedCssModuleBindingDiagnosticReason;
  location: SourceAnchor;
  rawExpressionText: string;
  traces: AnalysisTrace[];
};
