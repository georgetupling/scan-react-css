import type {
  ModuleFactsDeclarationIndex,
  ModuleFactsExportRecord,
  ModuleFactsImportKind,
  ModuleFactsImportName,
  ModuleFactsImportRecord,
} from "../../../module-facts/types.js";

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
