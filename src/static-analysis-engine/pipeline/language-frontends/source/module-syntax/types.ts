import type {
  ModuleFactsDeclarationIndex,
  ModuleFactsExportRecord,
  ModuleFactsImportKind,
  ModuleFactsImportName,
  ModuleFactsImportRecord,
} from "../../../module-facts/types.js";

// TODO(language-frontends): Replace these module-facts aliases with frontend-owned syntax
// records once module-facts consumes an explicit adapter/projection. The frontend stage should
// describe import/export/declaration syntax; module-facts should own resolution-oriented
// classification and resolver indexes.
export type SourceModuleSyntaxFacts = {
  imports: SourceImportSyntaxRecord[];
  exports: SourceExportSyntaxRecord[];
  declarations: SourceDeclarationSyntaxIndex;
};

export type SourceImportSyntaxKind = ModuleFactsImportKind;
export type SourceImportSyntaxName = ModuleFactsImportName;
export type SourceImportSyntaxRecord = ModuleFactsImportRecord;
export type SourceExportSyntaxRecord = ModuleFactsExportRecord;
export type SourceDeclarationSyntaxIndex = ModuleFactsDeclarationIndex;
