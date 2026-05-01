import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectEvidence } from "../../dist/static-analysis-engine.js";

test("project evidence assembly returns deterministic empty facts", () => {
  const result = buildProjectEvidence();

  assert.deepEqual(result.meta, {
    generatedAtStage: "project-evidence-assembly",
    sourceFileCount: 0,
    componentCount: 0,
    stylesheetCount: 0,
    classDefinitionCount: 0,
    classReferenceCount: 0,
    relationCount: 0,
    diagnosticCount: 0,
  });
  assert.deepEqual(result.entities.sourceFiles, []);
  assert.deepEqual(result.entities.stylesheets, []);
  assert.deepEqual(result.entities.components, []);
  assert.deepEqual(result.entities.renderSubtrees, []);
  assert.deepEqual(result.entities.classDefinitions, []);
  assert.deepEqual(result.entities.classContexts, []);
  assert.deepEqual(result.entities.classReferences, []);
  assert.deepEqual(result.entities.staticallySkippedClassReferences, []);
  assert.deepEqual(result.entities.selectorQueries, []);
  assert.deepEqual(result.entities.selectorBranches, []);
  assert.deepEqual(result.entities.unsupportedClassReferences, []);
  assert.deepEqual(result.entities.cssModuleImports, []);
  assert.deepEqual(result.entities.cssModuleAliases, []);
  assert.deepEqual(result.entities.cssModuleDestructuredBindings, []);
  assert.deepEqual(result.entities.cssModuleMemberReferences, []);
  assert.deepEqual(result.entities.cssModuleReferenceDiagnostics, []);

  assert.deepEqual(result.relations.moduleImports, []);
  assert.deepEqual(result.relations.componentRenders, []);
  assert.deepEqual(result.relations.stylesheetReachability, []);
  assert.deepEqual(result.relations.referenceMatches, []);
  assert.deepEqual(result.relations.selectorMatches, []);
  assert.deepEqual(result.relations.providerClassSatisfactions, []);
  assert.deepEqual(result.relations.cssModuleMemberMatches, []);
  assert.deepEqual(result.diagnostics, []);

  assert.equal(result.indexes.sourceFilesById.size, 0);
  assert.equal(result.indexes.sourceFileIdByPath.size, 0);
  assert.equal(result.indexes.stylesheetsById.size, 0);
  assert.equal(result.indexes.stylesheetIdByPath.size, 0);
  assert.equal(result.indexes.componentsById.size, 0);
  assert.equal(result.indexes.componentIdsBySourceFileId.size, 0);
  assert.equal(result.indexes.classDefinitionsById.size, 0);
  assert.equal(result.indexes.classDefinitionIdsByClassName.size, 0);
  assert.equal(result.indexes.classDefinitionIdsByStylesheetId.size, 0);
  assert.equal(result.indexes.classReferencesById.size, 0);
  assert.equal(result.indexes.classReferenceIdsByClassName.size, 0);
  assert.equal(result.indexes.classReferenceIdsBySourceFileId.size, 0);
  assert.equal(result.indexes.classReferenceMatchIdsByDefinitionId.size, 0);
  assert.equal(result.indexes.classReferenceMatchIdsByReferenceId.size, 0);
  assert.equal(result.indexes.stylesheetReachabilityIdsByStylesheetId.size, 0);
  assert.equal(result.indexes.selectorBranchIdsByStylesheetId.size, 0);
  assert.equal(result.indexes.diagnosticById.size, 0);
  assert.equal(result.indexes.diagnosticsByTargetId.size, 0);
});
