export type SourceImportKind = "source" | "css" | "external-css";

export type SourceImportFact = {
  specifier: string;
  kind: SourceImportKind;
  isRelative: boolean;
  resolvedPath?: string;
};

export type CssModuleImportFact = {
  specifier: string;
  localName: string;
  resolvedPath?: string;
};

export type ClassReferenceKind =
  | "string-literal"
  | "template-literal"
  | "conditional"
  | "helper-call"
  | "css-module-property"
  | "css-module-dynamic-property";

export type ClassReferenceFact = {
  className?: string;
  kind: ClassReferenceKind;
  confidence: "low" | "medium" | "high";
  source: string;
  line: number;
  column: number;
  metadata?: Record<string, unknown>;
};

export type SourceFileFact = {
  filePath: string;
  imports: SourceImportFact[];
  cssModuleImports: CssModuleImportFact[];
  classReferences: ClassReferenceFact[];
  helperImports: string[];
};

export type CssSelectorMatchKind = "standalone" | "compound" | "contextual" | "complex";

export type CssSelectorBranchFact = {
  raw: string;
  matchKind: CssSelectorMatchKind;
  subjectClassNames: string[];
  requiredClassNames: string[];
  contextClassNames: string[];
  negativeClassNames: string[];
  hasCombinators: boolean;
  hasSubjectModifiers: boolean;
  hasUnknownSemantics: boolean;
};

export type CssClassDefinitionFact = {
  className: string;
  selector: string;
  selectorBranch: CssSelectorBranchFact;
  declarations: string[];
  line: number;
};

export type CssImportFact = {
  specifier: string;
  isExternal: boolean;
};

export type CssFileFact = {
  filePath: string;
  classDefinitions: CssClassDefinitionFact[];
  imports: CssImportFact[];
};

export type ExternalCssFact = {
  specifier: string;
  resolvedPath: string;
  classDefinitions: CssClassDefinitionFact[];
  imports: CssImportFact[];
};

export type HtmlStylesheetLinkFact = {
  href: string;
  isRemote: boolean;
};

export type HtmlFileFact = {
  filePath: string;
  stylesheetLinks: HtmlStylesheetLinkFact[];
};

export type ProjectFactExtractionResult = {
  rootDir: string;
  sourceFacts: SourceFileFact[];
  cssFacts: CssFileFact[];
  externalCssFacts: ExternalCssFact[];
  htmlFacts: HtmlFileFact[];
  operationalWarnings: string[];
};
