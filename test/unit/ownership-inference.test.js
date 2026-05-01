import assert from "node:assert/strict";
import test from "node:test";

import { buildOwnershipInference } from "../../dist/static-analysis-engine.js";

test("ownership inference returns deterministic empty facts", () => {
  const result = buildOwnershipInference();

  assert.deepEqual(result.meta, {
    generatedAtStage: "ownership-inference",
    classOwnershipCount: 0,
    definitionConsumerCount: 0,
    ownerCandidateCount: 0,
    stylesheetOwnershipCount: 0,
    classificationCount: 0,
    diagnosticCount: 0,
  });
  assert.deepEqual(result.classOwnership, []);
  assert.deepEqual(result.definitionConsumers, []);
  assert.deepEqual(result.ownerCandidates, []);
  assert.deepEqual(result.stylesheetOwnership, []);
  assert.deepEqual(result.classifications, []);
  assert.deepEqual(result.diagnostics, []);

  assert.equal(result.indexes.classOwnershipById.size, 0);
  assert.equal(result.indexes.classOwnershipIdsByClassDefinitionId.size, 0);
  assert.equal(result.indexes.classOwnershipIdsByStylesheetId.size, 0);
  assert.equal(result.indexes.classOwnershipIdsByClassName.size, 0);
  assert.equal(result.indexes.consumerEvidenceById.size, 0);
  assert.equal(result.indexes.consumerEvidenceIdsByClassDefinitionId.size, 0);
  assert.equal(result.indexes.consumerEvidenceIdsByComponentId.size, 0);
  assert.equal(result.indexes.ownerCandidateById.size, 0);
  assert.equal(result.indexes.ownerCandidateIdsByOwnerComponentId.size, 0);
  assert.equal(result.indexes.ownerCandidateIdsByStylesheetId.size, 0);
  assert.equal(result.indexes.stylesheetOwnershipById.size, 0);
  assert.equal(result.indexes.stylesheetOwnershipByStylesheetId.size, 0);
  assert.equal(result.indexes.classificationById.size, 0);
  assert.equal(result.indexes.classificationIdsByTargetId.size, 0);
  assert.equal(result.indexes.diagnosticById.size, 0);
  assert.equal(result.indexes.diagnosticsByTargetId.size, 0);
});
