import type { AnalysisTrace } from "../../types/analysis.js";
import type { FactNodeId } from "../fact-graph/index.js";
import type {
  ClassContextAnalysis,
  ClassDefinitionAnalysis,
  ClassReferenceAnalysis,
  ClassReferenceMatchRelation,
  ComponentAnalysis,
  ComponentRenderRelation,
  CssModuleAliasAnalysis,
  CssModuleDestructuredBindingAnalysis,
  CssModuleImportAnalysis,
  CssModuleMemberMatchRelation,
  CssModuleMemberReferenceAnalysis,
  CssModuleReferenceDiagnosticAnalysis,
  ModuleImportRelation,
  ProjectAnalysisId,
  ProviderClassSatisfactionRelation,
  RenderSubtreeAnalysis,
  SelectorBranchAnalysis,
  SelectorMatchRelation,
  SelectorQueryAnalysis,
  SourceFileAnalysis,
  StaticallySkippedClassReferenceAnalysis,
  StylesheetAnalysis,
  StylesheetReachabilityRelation,
  UnsupportedClassReferenceAnalysis,
} from "../project-analysis/index.js";

export type ProjectEvidenceDiagnosticId = string;

export type ProjectEvidenceAssemblyResult = {
  meta: ProjectEvidenceAssemblyMeta;
  entities: ProjectEvidenceEntities;
  relations: ProjectEvidenceRelations;
  diagnostics: ProjectEvidenceDiagnostic[];
  indexes: ProjectEvidenceIndexes;
};

export type ProjectEvidenceAssemblyMeta = {
  generatedAtStage: "project-evidence-assembly";
  sourceFileCount: number;
  componentCount: number;
  stylesheetCount: number;
  classDefinitionCount: number;
  classReferenceCount: number;
  relationCount: number;
  diagnosticCount: number;
};

export type ProjectEvidenceEntities = {
  sourceFiles: SourceFileAnalysis[];
  stylesheets: StylesheetAnalysis[];
  components: ComponentAnalysis[];
  renderSubtrees: RenderSubtreeAnalysis[];
  classDefinitions: ClassDefinitionAnalysis[];
  classContexts: ClassContextAnalysis[];
  classReferences: ClassReferenceAnalysis[];
  staticallySkippedClassReferences: StaticallySkippedClassReferenceAnalysis[];
  selectorQueries: SelectorQueryAnalysis[];
  selectorBranches: SelectorBranchAnalysis[];
  unsupportedClassReferences: UnsupportedClassReferenceAnalysis[];
  cssModuleImports: CssModuleImportAnalysis[];
  cssModuleAliases: CssModuleAliasAnalysis[];
  cssModuleDestructuredBindings: CssModuleDestructuredBindingAnalysis[];
  cssModuleMemberReferences: CssModuleMemberReferenceAnalysis[];
  cssModuleReferenceDiagnostics: CssModuleReferenceDiagnosticAnalysis[];
};

export type ProjectEvidenceRelations = {
  moduleImports: ModuleImportRelation[];
  componentRenders: ComponentRenderRelation[];
  stylesheetReachability: StylesheetReachabilityRelation[];
  referenceMatches: ClassReferenceMatchRelation[];
  selectorMatches: SelectorMatchRelation[];
  providerClassSatisfactions: ProviderClassSatisfactionRelation[];
  cssModuleMemberMatches: CssModuleMemberMatchRelation[];
};

export type ProjectEvidenceDiagnostic = {
  id: ProjectEvidenceDiagnosticId;
  targetKind: ProjectEvidenceDiagnosticTargetKind;
  targetId?: ProjectAnalysisId | FactNodeId;
  severity: "debug" | "warning";
  code: ProjectEvidenceDiagnosticCode;
  message: string;
  traces: AnalysisTrace[];
};

export type ProjectEvidenceDiagnosticTargetKind =
  | "project"
  | "source-file"
  | "stylesheet"
  | "class-reference"
  | "class-definition"
  | "selector-branch";

export type ProjectEvidenceDiagnosticCode =
  | "missing-project-evidence"
  | "contradictory-project-evidence";

export type ProjectEvidenceIndexes = {
  sourceFilesById: Map<ProjectAnalysisId, SourceFileAnalysis>;
  sourceFileIdByPath: Map<string, ProjectAnalysisId>;
  stylesheetsById: Map<ProjectAnalysisId, StylesheetAnalysis>;
  stylesheetIdByPath: Map<string, ProjectAnalysisId>;
  componentsById: Map<ProjectAnalysisId, ComponentAnalysis>;
  componentIdsBySourceFileId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  classDefinitionsById: Map<ProjectAnalysisId, ClassDefinitionAnalysis>;
  classDefinitionIdsByClassName: Map<string, ProjectAnalysisId[]>;
  classDefinitionIdsByStylesheetId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  classReferencesById: Map<ProjectAnalysisId, ClassReferenceAnalysis>;
  classReferenceIdsByClassName: Map<string, ProjectAnalysisId[]>;
  classReferenceIdsBySourceFileId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  classReferenceMatchIdsByDefinitionId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  classReferenceMatchIdsByReferenceId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  stylesheetReachabilityIdsByStylesheetId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  selectorBranchIdsByStylesheetId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  diagnosticById: Map<ProjectEvidenceDiagnosticId, ProjectEvidenceDiagnostic>;
  diagnosticsByTargetId: Map<ProjectAnalysisId | FactNodeId, ProjectEvidenceDiagnosticId[]>;
};
