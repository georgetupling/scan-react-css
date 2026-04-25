import type { ClassExpressionSummary } from "../render-model/abstract-values/types.js";
import type { UnsupportedClassReferenceDiagnostic } from "../render-model/class-reference-diagnostics/types.js";
import type { ExternalCssSummary } from "../external-css/types.js";
import type { ModuleImportKind } from "../module-graph/types.js";
import type {
  ReachabilityAvailability,
  StylesheetReachabilityContextRecord,
} from "../reachability/types.js";
import type { RenderGraphEdge } from "../render-model/render-graph/types.js";
import type { RenderSubtree } from "../render-model/render-ir/types.js";
import type { SelectorConstraint, SelectorQueryResult } from "../selector-analysis/types.js";
import type { AnalysisConfidence, AnalysisTrace } from "../../types/analysis.js";
import type { SourceAnchor } from "../../types/core.js";
import type {
  CssAtRuleContextFact,
  CssClassDefinitionFact,
  CssDeclarationFact,
} from "../../types/css.js";

export type ProjectAnalysisId = string;

export type ProjectAnalysis = {
  meta: ProjectAnalysisMeta;
  inputs: ProjectAnalysisInputs;
  entities: ProjectAnalysisEntities;
  relations: ProjectAnalysisRelations;
  indexes: ProjectAnalysisIndexes;
};

export type ProjectAnalysisMeta = {
  sourceFileCount: number;
  cssFileCount: number;
  externalCssEnabled: boolean;
};

export type ProjectAnalysisInputs = {
  sourceFiles: SourceFileRecord[];
  cssFiles: CssFileRecord[];
  externalCss: ExternalCssSummary;
};

export type SourceFileRecord = {
  id: ProjectAnalysisId;
  filePath: string;
};

export type CssFileRecord = {
  id: ProjectAnalysisId;
  filePath?: string;
};

export type ProjectAnalysisEntities = {
  sourceFiles: SourceFileAnalysis[];
  stylesheets: StylesheetAnalysis[];
  classReferences: ClassReferenceAnalysis[];
  classDefinitions: ClassDefinitionAnalysis[];
  selectorQueries: SelectorQueryAnalysis[];
  components: ComponentAnalysis[];
  renderSubtrees: RenderSubtreeAnalysis[];
  unsupportedClassReferences: UnsupportedClassReferenceAnalysis[];
};

export type SourceFileAnalysis = SourceFileRecord & {
  moduleKind: "source";
};

export type StylesheetOrigin = "project-css" | "css-module" | "external-import" | "unknown";

export type StylesheetAnalysis = CssFileRecord & {
  origin: StylesheetOrigin;
  definitions: ProjectAnalysisId[];
  selectors: ProjectAnalysisId[];
};

export type ClassReferenceOrigin = "render-ir" | "unknown";

export type ClassReferenceExpressionKind =
  | "exact-string"
  | "string-set"
  | "dynamic"
  | "unsupported";

export type ClassReferenceAnalysis = {
  id: ProjectAnalysisId;
  sourceFileId: ProjectAnalysisId;
  componentId?: ProjectAnalysisId;
  renderSubtreeId?: ProjectAnalysisId;
  location: SourceAnchor;
  emittedElementLocation?: SourceAnchor;
  placementLocation?: SourceAnchor;
  origin: ClassReferenceOrigin;
  expressionKind: ClassReferenceExpressionKind;
  rawExpressionText: string;
  definiteClassNames: string[];
  possibleClassNames: string[];
  unknownDynamic: boolean;
  confidence: AnalysisConfidence;
  traces: AnalysisTrace[];
  sourceSummary: ClassExpressionSummary;
};

export type ClassDefinitionSelectorKind =
  | "simple-root"
  | "compound"
  | "contextual"
  | "complex"
  | "unsupported";

export type ClassDefinitionAnalysis = {
  id: ProjectAnalysisId;
  stylesheetId: ProjectAnalysisId;
  className: string;
  selectorText: string;
  selectorKind: ClassDefinitionSelectorKind;
  line: number;
  atRuleContext: CssAtRuleContextFact[];
  declarationProperties: string[];
  declarationSignature: string;
  isCssModule: boolean;
  sourceDefinition: CssClassDefinitionFact;
};

export type SelectorQueryAnalysis = {
  id: ProjectAnalysisId;
  stylesheetId?: ProjectAnalysisId;
  selectorText: string;
  location?: SourceAnchor;
  constraint?: SelectorConstraint | { kind: "unsupported"; reason: string };
  outcome: SelectorQueryResult["outcome"];
  status: SelectorQueryResult["status"];
  confidence: SelectorQueryResult["confidence"];
  traces: AnalysisTrace[];
  sourceResult: SelectorQueryResult;
};

export type ComponentAnalysis = {
  id: ProjectAnalysisId;
  filePath: string;
  componentName: string;
  exported: boolean;
  location: SourceAnchor;
};

export type RenderSubtreeAnalysis = {
  id: ProjectAnalysisId;
  componentId?: ProjectAnalysisId;
  filePath: string;
  componentName?: string;
  exported: boolean;
  location: SourceAnchor;
  sourceSubtree: RenderSubtree;
};

export type UnsupportedClassReferenceAnalysis = {
  id: ProjectAnalysisId;
  sourceFileId: ProjectAnalysisId;
  location: SourceAnchor;
  rawExpressionText: string;
  reason: UnsupportedClassReferenceDiagnostic["reason"];
  traces: AnalysisTrace[];
  sourceDiagnostic: UnsupportedClassReferenceDiagnostic;
};

export type ProjectAnalysisRelations = {
  moduleImports: ModuleImportRelation[];
  componentRenders: ComponentRenderRelation[];
  stylesheetReachability: StylesheetReachabilityRelation[];
  referenceMatches: ClassReferenceMatchRelation[];
  selectorMatches: SelectorMatchRelation[];
  providerClassSatisfactions: ProviderClassSatisfactionRelation[];
};

export type ModuleImportRelation = {
  fromSourceFileId: ProjectAnalysisId;
  toModuleId?: string;
  specifier: string;
  importKind: ModuleImportKind;
};

export type ComponentRenderRelation = {
  fromComponentId: ProjectAnalysisId;
  toComponentId?: ProjectAnalysisId;
  renderPath: RenderGraphEdge["renderPath"];
  resolution: RenderGraphEdge["resolution"];
  location: SourceAnchor;
  traces: AnalysisTrace[];
};

export type StylesheetReachabilityRelation = {
  stylesheetId: ProjectAnalysisId;
  sourceFileId?: ProjectAnalysisId;
  componentId?: ProjectAnalysisId;
  availability: ReachabilityAvailability;
  contexts: StylesheetReachabilityContextRecord[];
  reasons: string[];
  traces: AnalysisTrace[];
};

export type ClassReferenceMatchRelation = {
  id: ProjectAnalysisId;
  referenceId: ProjectAnalysisId;
  definitionId: ProjectAnalysisId;
  reachability: ReachabilityAvailability;
  matchKind: "reachable-stylesheet" | "unreachable-stylesheet";
  reasons: string[];
  traces: AnalysisTrace[];
};

export type SelectorMatchRelation = {
  id: ProjectAnalysisId;
  selectorQueryId: ProjectAnalysisId;
  stylesheetId?: ProjectAnalysisId;
  availability?: ReachabilityAvailability;
  outcome: SelectorQueryResult["outcome"];
  contextCount: number;
  matchedContextCount: number;
  reasons: string[];
  traces: AnalysisTrace[];
};

export type ProviderClassSatisfactionRelation = {
  id: ProjectAnalysisId;
  referenceId: ProjectAnalysisId;
  className: string;
  provider: string;
  reasons: string[];
  traces: AnalysisTrace[];
};

export type ProjectAnalysisIndexes = {
  sourceFileIdByPath: Map<string, ProjectAnalysisId>;
  stylesheetIdByPath: Map<string, ProjectAnalysisId>;
  componentIdByFilePathAndName: Map<string, ProjectAnalysisId>;
  definitionsByClassName: Map<string, ProjectAnalysisId[]>;
  definitionsByStylesheetId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  referencesByClassName: Map<string, ProjectAnalysisId[]>;
  referencesBySourceFileId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  reachableStylesheetsBySourceFileId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  reachableStylesheetsByComponentId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  selectorQueriesByStylesheetId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  matchesByReferenceId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
  selectorMatchesByQueryId: Map<ProjectAnalysisId, ProjectAnalysisId[]>;
};

export type ProjectAnalysisBuildInput = {
  moduleGraph: import("../module-graph/types.js").ModuleGraph;
  cssFiles: import("../css-analysis/types.js").ExperimentalCssFileAnalysis[];
  externalCssSummary: ExternalCssSummary;
  reachabilitySummary: import("../reachability/types.js").ReachabilitySummary;
  renderGraph: import("../render-model/render-graph/types.js").RenderGraph;
  renderSubtrees: RenderSubtree[];
  unsupportedClassReferences: UnsupportedClassReferenceDiagnostic[];
  selectorQueryResults: SelectorQueryResult[];
};

export type DeclarationForSignature = Pick<CssDeclarationFact, "property" | "value">;
