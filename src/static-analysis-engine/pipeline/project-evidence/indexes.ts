import type {
  ClassReferenceAnalysis,
  ProjectEvidenceId,
  StylesheetReachabilityRelation,
} from "./analysisTypes.js";
import { stylesheetReachabilityEvidenceId } from "./ids.js";
import type {
  ProjectEvidenceDiagnostic,
  ProjectEvidenceDiagnosticId,
  ProjectEvidenceEntities,
  ProjectEvidenceIndexes,
  ProjectEvidenceRelations,
} from "./types.js";

export function buildIndexes(input: {
  entities: ProjectEvidenceEntities;
  relations: ProjectEvidenceRelations;
  diagnostics: ProjectEvidenceDiagnostic[];
}): ProjectEvidenceIndexes {
  const sourceFilesById = new Map(
    input.entities.sourceFiles.map((sourceFile) => [sourceFile.id, sourceFile]),
  );
  const sourceFileIdByPath = new Map(
    input.entities.sourceFiles.map((sourceFile) => [sourceFile.filePath, sourceFile.id]),
  );
  const stylesheetsById = new Map(
    input.entities.stylesheets.map((stylesheet) => [stylesheet.id, stylesheet]),
  );
  const stylesheetIdByPath = new Map(
    input.entities.stylesheets
      .filter((stylesheet) => Boolean(stylesheet.filePath))
      .map((stylesheet) => [stylesheet.filePath ?? "", stylesheet.id]),
  );
  const componentsById = new Map(
    input.entities.components.map((component) => [component.id, component]),
  );
  const componentIdsBySourceFileId = new Map<ProjectEvidenceId, ProjectEvidenceId[]>();
  const classDefinitionsById = new Map(
    input.entities.classDefinitions.map((definition) => [definition.id, definition]),
  );
  const classDefinitionIdsByClassName = new Map<string, ProjectEvidenceId[]>();
  const classDefinitionIdsByStylesheetId = new Map<ProjectEvidenceId, ProjectEvidenceId[]>();
  const classReferencesById = new Map(
    input.entities.classReferences.map((reference) => [reference.id, reference]),
  );
  const classReferenceIdsByClassName = new Map<string, ProjectEvidenceId[]>();
  const classReferenceIdsBySourceFileId = new Map<ProjectEvidenceId, ProjectEvidenceId[]>();
  const classReferenceMatchIdsByDefinitionId = new Map<ProjectEvidenceId, ProjectEvidenceId[]>();
  const classReferenceMatchIdsByReferenceId = new Map<ProjectEvidenceId, ProjectEvidenceId[]>();
  const stylesheetReachabilityIdsByStylesheetId = new Map<ProjectEvidenceId, ProjectEvidenceId[]>();
  const selectorBranchIdsByStylesheetId = new Map<ProjectEvidenceId, ProjectEvidenceId[]>();
  const diagnosticById = new Map<ProjectEvidenceDiagnosticId, ProjectEvidenceDiagnostic>();
  const diagnosticsByTargetId = new Map<ProjectEvidenceId, ProjectEvidenceDiagnosticId[]>();

  for (const component of input.entities.components) {
    const sourceFileId = sourceFileIdByPath.get(component.filePath);
    if (sourceFileId) {
      pushMapValue(componentIdsBySourceFileId, sourceFileId, component.id);
    }
  }

  for (const definition of input.entities.classDefinitions) {
    pushMapValue(classDefinitionIdsByClassName, definition.className, definition.id);
    pushMapValue(classDefinitionIdsByStylesheetId, definition.stylesheetId, definition.id);
  }

  for (const reference of input.entities.classReferences) {
    pushMapValue(classReferenceIdsBySourceFileId, reference.sourceFileId, reference.id);
    for (const className of referenceClassNames(reference)) {
      pushMapValue(classReferenceIdsByClassName, className, reference.id);
    }
  }

  for (const match of input.relations.referenceMatches) {
    pushMapValue(classReferenceMatchIdsByDefinitionId, match.definitionId, match.id);
    pushMapValue(classReferenceMatchIdsByReferenceId, match.referenceId, match.id);
  }

  for (const relation of input.relations.stylesheetReachability) {
    pushMapValue(
      stylesheetReachabilityIdsByStylesheetId,
      relation.stylesheetId,
      stylesheetReachabilityRelationId(relation),
    );
  }

  for (const branch of input.entities.selectorBranches) {
    if (branch.stylesheetId) {
      pushMapValue(selectorBranchIdsByStylesheetId, branch.stylesheetId, branch.id);
    }
  }

  for (const diagnostic of input.diagnostics) {
    diagnosticById.set(diagnostic.id, diagnostic);
    if (diagnostic.targetId) {
      pushMapValue(diagnosticsByTargetId, diagnostic.targetId, diagnostic.id);
    }
  }

  [
    componentIdsBySourceFileId,
    classDefinitionIdsByClassName,
    classDefinitionIdsByStylesheetId,
    classReferenceIdsByClassName,
    classReferenceIdsBySourceFileId,
    classReferenceMatchIdsByDefinitionId,
    classReferenceMatchIdsByReferenceId,
    stylesheetReachabilityIdsByStylesheetId,
    selectorBranchIdsByStylesheetId,
    diagnosticsByTargetId,
  ].forEach(sortMapValues);

  return {
    sourceFilesById,
    sourceFileIdByPath,
    stylesheetsById,
    stylesheetIdByPath,
    componentsById,
    componentIdsBySourceFileId,
    classDefinitionsById,
    classDefinitionIdsByClassName,
    classDefinitionIdsByStylesheetId,
    classReferencesById,
    classReferenceIdsByClassName,
    classReferenceIdsBySourceFileId,
    classReferenceMatchIdsByDefinitionId,
    classReferenceMatchIdsByReferenceId,
    stylesheetReachabilityIdsByStylesheetId,
    selectorBranchIdsByStylesheetId,
    diagnosticById,
    diagnosticsByTargetId,
  };
}

function referenceClassNames(reference: ClassReferenceAnalysis): string[] {
  return [...new Set([...reference.definiteClassNames, ...reference.possibleClassNames])].sort(
    (left, right) => left.localeCompare(right),
  );
}

function stylesheetReachabilityRelationId(relation: StylesheetReachabilityRelation): string {
  return stylesheetReachabilityEvidenceId({
    stylesheetId: relation.stylesheetId,
    sourceFileId: relation.sourceFileId,
    componentId: relation.componentId,
    availability: relation.availability,
  });
}

function pushMapValue<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function sortMapValues(map: Map<string, string[]>): void {
  for (const [key, values] of map.entries()) {
    map.set(
      key,
      [...new Set(values)].sort((left, right) => left.localeCompare(right)),
    );
  }
}
