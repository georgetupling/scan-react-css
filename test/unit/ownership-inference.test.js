import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOwnershipInference,
  buildProjectEvidence,
  classOwnershipAnalysisFromOwnershipInference,
} from "../../dist/static-analysis-engine.js";

test("ownership inference returns deterministic empty facts from Stage 7A and Stage 6 evidence", () => {
  const result = buildOwnershipInference({
    projectEvidence: buildProjectEvidence(),
    selectorReachability: emptySelectorReachability(),
    options: {
      sharedCssPatterns: [],
      includeTraces: false,
    },
  });

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

test("ownership inference ports class ownership evidence deterministically", () => {
  const result = buildOwnershipInference({
    projectEvidence: buildProjectEvidence({
      entities: {
        classReferences: [
          classReference({
            id: "reference:alpha",
            sourceFileId: "source:alpha",
            componentId: "component-a",
            emittedByComponentId: "component-a",
            suppliedByComponentId: "supplier-a",
            className: "alpha",
          }),
          classReference({
            id: "reference:beta",
            sourceFileId: "source:beta",
            componentId: "component-b",
            className: "beta",
          }),
        ],
        cssModuleMemberReferences: [
          {
            id: "css-module-reference:gamma",
            importId: "css-module-import:gamma",
            sourceFileId: "source:gamma",
            stylesheetId: "style-c",
            localName: "styles",
            memberName: "gamma",
            accessKind: "property",
            location: { filePath: "src/Gamma.tsx", startLine: 1, startColumn: 1 },
            rawExpressionText: "styles.gamma",
            traces: [],
          },
        ],
      },
      relations: {
        referenceMatches: [
          referenceMatch({
            id: "match:beta",
            referenceId: "reference:beta",
            definitionId: "def-b",
            className: "beta",
            referenceClassKind: "definite",
            reachability: "definite",
          }),
          referenceMatch({
            id: "match:alpha",
            referenceId: "reference:alpha",
            definitionId: "def-a",
            className: "alpha",
            referenceClassKind: "possible",
            reachability: "possible",
          }),
        ],
        cssModuleMemberMatches: [
          {
            id: "css-module-match:gamma",
            referenceId: "css-module-reference:gamma",
            importId: "css-module-import:gamma",
            stylesheetId: "style-c",
            definitionId: "def-c",
            className: "gamma",
            exportName: "gamma",
            status: "matched",
            reasons: [],
            traces: [],
          },
        ],
      },
    }),
    selectorReachability: emptySelectorReachability(),
    options: {
      includeTraces: false,
    },
    compatibility: {
      classOwnership: [
        legacyClassOwnership({
          id: "class-ownership:def-b",
          classDefinitionId: "def-b",
          stylesheetId: "style-b",
          className: "beta",
          evidenceKind: "single-importing-component",
          ownerComponentId: "component-b",
          reasons: ["single-importing-component", "same-directory"],
          confidence: "high",
        }),
        legacyClassOwnership({
          id: "class-ownership:def-c",
          classDefinitionId: "def-c",
          stylesheetId: "style-c",
          className: "gamma",
          evidenceKind: "single-consuming-component",
          ownerComponentId: "component-c",
          reasons: ["single-consuming-component"],
          confidence: "medium",
        }),
        legacyClassOwnership({
          id: "class-ownership:def-a",
          classDefinitionId: "def-a",
          stylesheetId: "style-a",
          className: "alpha",
          evidenceKind: "single-consuming-component",
          ownerComponentId: "component-a",
          reasons: ["single-consuming-component"],
          confidence: "medium",
        }),
      ],
    },
  });

  assert.equal(result.meta.classOwnershipCount, 3);
  assert.equal(result.meta.definitionConsumerCount, 3);
  assert.equal(result.meta.ownerCandidateCount, 3);
  assert.deepEqual(
    result.classOwnership.map((ownership) => ownership.id),
    ["class-ownership:def-a", "class-ownership:def-b", "class-ownership:def-c"],
  );
  assert.deepEqual(
    result.classOwnership.map((ownership) => ownership.compatibilityEvidenceKind),
    ["single-consuming-component", "single-importing-component", "single-consuming-component"],
  );
  assert.deepEqual(result.indexes.classOwnershipIdsByClassName.get("alpha"), [
    "class-ownership:def-a",
  ]);
  assert.deepEqual(result.indexes.ownerCandidateIdsByOwnerComponentId.get("component-a"), [
    result.classOwnership[0].ownerCandidateIds[0],
  ]);
  assert.deepEqual(
    result.definitionConsumers.map((consumer) => ({
      classDefinitionId: consumer.classDefinitionId,
      referenceId: consumer.referenceId,
      matchId: consumer.matchId,
      consumingComponentId: consumer.consumingComponentId,
      emittingComponentId: consumer.emittingComponentId,
      supplyingComponentId: consumer.supplyingComponentId,
      availability: consumer.availability,
      consumptionKind: consumer.consumptionKind,
      confidence: consumer.confidence,
    })),
    [
      {
        classDefinitionId: "def-a",
        referenceId: "reference:alpha",
        matchId: "match:alpha",
        consumingComponentId: "component-a",
        emittingComponentId: "component-a",
        supplyingComponentId: "supplier-a",
        availability: "possible",
        consumptionKind: "forwarded-prop",
        confidence: "medium",
      },
      {
        classDefinitionId: "def-b",
        referenceId: "reference:beta",
        matchId: "match:beta",
        consumingComponentId: "component-b",
        emittingComponentId: undefined,
        supplyingComponentId: undefined,
        availability: "definite",
        consumptionKind: "direct-reference",
        confidence: "high",
      },
      {
        classDefinitionId: "def-c",
        referenceId: "css-module-reference:gamma",
        matchId: "css-module-match:gamma",
        consumingComponentId: undefined,
        emittingComponentId: undefined,
        supplyingComponentId: undefined,
        availability: "definite",
        consumptionKind: "css-module-member",
        confidence: "high",
      },
    ],
  );
  assert.deepEqual(result.classOwnership[0].consumerSummary, {
    classDefinitionId: "def-a",
    className: "alpha",
    consumerComponentIds: ["component-a"],
    consumerSourceFileIds: ["source:alpha"],
    referenceIds: ["reference:alpha"],
    matchIds: ["match:alpha"],
  });

  const projectAnalysisOwnership = classOwnershipAnalysisFromOwnershipInference(result);
  assert.deepEqual(
    projectAnalysisOwnership.map((ownership) => ownership.evidenceKind),
    ["single-consuming-component", "single-importing-component", "single-consuming-component"],
  );
  assert.deepEqual(projectAnalysisOwnership[0].ownerCandidates[0], {
    kind: "component",
    id: "component-a",
    path: "src/Alpha.tsx",
    confidence: "medium",
    reasons: ["single-consuming-component"],
    traces: [],
  });
});

test("ownership inference builds stylesheet ownership evidence from Stage 7A imports", () => {
  const result = buildOwnershipInference({
    projectEvidence: buildProjectEvidence({
      entities: {
        sourceFiles: [
          sourceFile({ id: "source:button", filePath: "src/Button.tsx" }),
          sourceFile({ id: "source:card", filePath: "src/Card.tsx" }),
        ],
        components: [
          component({
            id: "component:button",
            filePath: "src/Button.tsx",
            componentName: "Button",
          }),
          component({ id: "component:card", filePath: "src/Card.tsx", componentName: "Card" }),
        ],
        stylesheets: [
          stylesheet({ id: "style:button", filePath: "src/Button.css" }),
          stylesheet({ id: "style:shared", filePath: "src/styles/shared.css" }),
          stylesheet({ id: "style:configured", filePath: "src/theme/app.css" }),
        ],
      },
      relations: {
        moduleImports: [
          moduleImport({
            fromSourceFileId: "source:button",
            specifier: "./Button.css",
            resolvedFilePath: "src/Button.css",
          }),
          moduleImport({
            fromSourceFileId: "source:button",
            specifier: "./styles/shared.css",
            resolvedFilePath: "src/styles/shared.css",
          }),
          moduleImport({
            fromSourceFileId: "source:card",
            specifier: "./theme/app.css",
            resolvedFilePath: "src/theme/app.css",
          }),
        ],
      },
    }),
    selectorReachability: emptySelectorReachability(),
    options: {
      sharedCssPatterns: ["src/theme/*.css"],
      includeTraces: false,
    },
  });

  assert.equal(result.meta.stylesheetOwnershipCount, 3);
  assert.equal(result.indexes.stylesheetOwnershipByStylesheetId.size, 3);

  const buttonOwnership = result.indexes.stylesheetOwnershipByStylesheetId.get("style:button");
  assert.ok(buttonOwnership);
  assert.deepEqual(buttonOwnership.importerComponentIds, ["component:button"]);
  assert.deepEqual(buttonOwnership.importerSourceFileIds, ["source:button"]);
  assert.equal(buttonOwnership.broadness, "private-component-like");
  assert.equal(buttonOwnership.configuredShared, false);
  assert.deepEqual(
    buttonOwnership.ownerCandidateIds.map(
      (candidateId) => result.indexes.ownerCandidateById.get(candidateId)?.ownerKind,
    ),
    ["component"],
  );

  const sharedOwnership = result.indexes.stylesheetOwnershipByStylesheetId.get("style:shared");
  assert.ok(sharedOwnership);
  assert.equal(sharedOwnership.broadness, "shared-like");
  assert.deepEqual(
    sharedOwnership.ownerCandidateIds
      .map((candidateId) => result.indexes.ownerCandidateById.get(candidateId)?.ownerKind)
      .sort(),
    ["component", "shared-layer"],
  );

  const configuredOwnership =
    result.indexes.stylesheetOwnershipByStylesheetId.get("style:configured");
  assert.ok(configuredOwnership);
  assert.equal(configuredOwnership.configuredShared, true);
  assert.equal(configuredOwnership.broadness, "shared-like");
  assert.deepEqual(
    result.indexes.classificationIdsByTargetId
      .get("style:configured")
      ?.map(
        (classificationId) =>
          result.indexes.classificationById.get(classificationId)?.classification,
      ),
    ["shared"],
  );
});

test("ownership inference preserves Stage 6 selector context evidence", () => {
  const selectorLocation = { filePath: "src/Button.css", startLine: 3, startColumn: 1 };
  const selectorReachability = selectorReachabilityWithBranch({
    selectorBranchNodeId: "selector-branch-node:panel",
    ruleKey: "rule:panel",
    branchText: ".button .panel",
    location: selectorLocation,
    requiredClassNames: ["button", "panel"],
    matchIds: ["selector-match:panel"],
    status: "definitely-matchable",
    requirement: {
      kind: "ancestor-descendant",
      ancestorClassName: "button",
      subjectClassName: "panel",
      normalizedSteps: [],
      parseNotes: [],
      traces: [],
    },
  });
  const result = buildOwnershipInference({
    projectEvidence: buildProjectEvidence({
      entities: {
        stylesheets: [stylesheet({ id: "style:button", filePath: "src/Button.css" })],
        components: [
          component({
            id: "component:button",
            filePath: "src/Button.tsx",
            componentName: "Button",
          }),
        ],
        classDefinitions: [
          classDefinition({
            id: "definition:panel",
            stylesheetId: "style:button",
            className: "panel",
            selectorText: ".button .panel",
            line: 3,
            contextClassNames: ["button"],
          }),
        ],
        classReferences: [
          classReference({
            id: "reference:panel",
            sourceFileId: "source:button",
            componentId: "component:button",
            className: "panel",
          }),
        ],
        selectorBranches: [
          selectorBranch({
            id: "project-selector-branch:panel",
            stylesheetId: "style:button",
            selectorText: ".button .panel",
            ruleKey: "rule:panel",
            location: selectorLocation,
          }),
        ],
      },
      relations: {
        referenceMatches: [
          referenceMatch({
            id: "match:panel",
            referenceId: "reference:panel",
            definitionId: "definition:panel",
            className: "panel",
            referenceClassKind: "definite",
            reachability: "definite",
          }),
        ],
      },
    }),
    selectorReachability,
    options: {
      includeTraces: false,
    },
    compatibility: {
      classOwnership: [
        legacyClassOwnership({
          id: "class-ownership:definition:panel",
          classDefinitionId: "definition:panel",
          stylesheetId: "style:button",
          className: "panel",
          evidenceKind: "single-importing-component",
          ownerComponentId: "component:button",
          reasons: ["single-importing-component", "sibling-basename-convention"],
          confidence: "high",
        }),
      ],
    },
  });

  assert.deepEqual(result.definitionConsumers[0].selectorBranchNodeIds, [
    "selector-branch-node:panel",
  ]);
  assert.deepEqual(result.definitionConsumers[0].selectorMatchIds, ["selector-match:panel"]);
  assert.equal(result.definitionConsumers[0].consumptionKind, "selector-context");

  const ownership = result.classOwnership[0];
  const classificationIds = result.indexes.classificationIdsByTargetId.get("definition:panel");
  assert.deepEqual(
    classificationIds?.map((id) => result.indexes.classificationById.get(id)?.classification),
    ["primitive-override"],
  );
  assert.ok(
    ownership.ownerCandidateIds.some((candidateId) =>
      result.indexes.ownerCandidateById
        .get(candidateId)
        ?.reasons.includes("selector-context-owner"),
    ),
  );
});

function legacyClassOwnership(input) {
  return {
    id: input.id,
    classDefinitionId: input.classDefinitionId,
    stylesheetId: input.stylesheetId,
    className: input.className,
    consumerSummary: {
      classDefinitionId: input.classDefinitionId,
      className: input.className,
      consumerComponentIds: [input.ownerComponentId],
      consumerSourceFileIds: [`source:${input.ownerComponentId}`],
      referenceIds: [`reference:${input.className}`],
      matchIds: [`match:${input.className}`],
    },
    ownerCandidates: [
      {
        kind: "component",
        id: input.ownerComponentId,
        path:
          input.ownerComponentId === "component-a"
            ? "src/Alpha.tsx"
            : input.ownerComponentId === "component-b"
              ? "src/Beta.tsx"
              : "src/Gamma.tsx",
        confidence: input.confidence,
        reasons: input.reasons,
        traces: [],
      },
    ],
    evidenceKind: input.evidenceKind,
    confidence: input.confidence,
    traces: [],
  };
}

function classDefinition(input) {
  return {
    id: input.id,
    stylesheetId: input.stylesheetId,
    className: input.className,
    selectorText: input.selectorText,
    selectorKind: input.contextClassNames.length > 0 ? "contextual" : "simple-root",
    line: input.line,
    atRuleContext: [],
    declarationProperties: [],
    declarationSignature: "",
    isCssModule: false,
    sourceDefinition: {
      className: input.className,
      selector: input.selectorText,
      selectorBranch: {
        raw: input.selectorText,
        matchKind: input.contextClassNames.length > 0 ? "contextual" : "standalone",
        subjectClassNames: [input.className],
        requiredClassNames: [...input.contextClassNames, input.className],
        contextClassNames: input.contextClassNames,
        negativeClassNames: [],
        hasCombinators: input.contextClassNames.length > 0,
        hasSubjectModifiers: false,
        hasUnknownSemantics: false,
      },
      declarations: [],
      declarationDetails: [],
      line: input.line,
      atRuleContext: [],
    },
  };
}

function selectorBranch(input) {
  return {
    id: input.id,
    selectorQueryId: `selector-query:${input.id}`,
    stylesheetId: input.stylesheetId,
    selectorText: input.selectorText,
    selectorListText: input.selectorText,
    branchIndex: 0,
    branchCount: 1,
    ruleKey: input.ruleKey,
    location: input.location,
    outcome: "matchable",
    status: "supported",
    confidence: "high",
    traces: [],
    sourceQuery: {},
  };
}

function sourceFile(input) {
  return {
    id: input.id,
    filePath: input.filePath,
    moduleKind: "source",
  };
}

function component(input) {
  return {
    id: input.id,
    componentKey: `${input.filePath}::${input.componentName}`,
    filePath: input.filePath,
    componentName: input.componentName,
    exported: true,
    location: { filePath: input.filePath, startLine: 1, startColumn: 1 },
  };
}

function stylesheet(input) {
  return {
    id: input.id,
    filePath: input.filePath,
    origin: "project-css",
    definitions: [],
    selectors: [],
  };
}

function moduleImport(input) {
  return {
    fromSourceFileId: input.fromSourceFileId,
    toModuleId: input.resolvedFilePath,
    resolvedFilePath: input.resolvedFilePath,
    specifier: input.specifier,
    importKind: "css",
  };
}

function selectorReachabilityWithBranch(input) {
  const key = [
    input.ruleKey,
    0,
    input.branchText,
    [
      input.location.filePath,
      input.location.startLine,
      input.location.startColumn,
      input.location.endLine ?? "",
      input.location.endColumn ?? "",
    ].join(":"),
  ].join(":");
  const branch = {
    selectorBranchNodeId: input.selectorBranchNodeId,
    selectorNodeId: "selector-node:panel",
    stylesheetNodeId: "stylesheet-node:button",
    branchText: input.branchText,
    selectorListText: input.branchText,
    branchIndex: 0,
    branchCount: 1,
    ruleKey: input.ruleKey,
    requirement: input.requirement,
    subject: {
      requiredClassNames: input.requiredClassNames,
      unsupportedParts: [],
    },
    status: input.status,
    confidence: "high",
    matchIds: input.matchIds,
    diagnosticIds: [],
    location: input.location,
    traces: [],
  };
  const match = {
    id: input.matchIds[0],
    selectorBranchNodeId: input.selectorBranchNodeId,
    subjectElementId: "element:panel",
    elementMatchIds: ["element-match:panel"],
    supportingEmissionSiteIds: ["emission:panel"],
    requiredClassNames: input.requiredClassNames,
    matchedClassNames: input.requiredClassNames,
    renderPathIds: ["render-path:panel"],
    placementConditionIds: [],
    certainty: "definite",
    confidence: "high",
    traces: [],
  };
  return {
    ...emptySelectorReachability(),
    meta: {
      generatedAtStage: "selector-reachability",
      selectorBranchCount: 1,
      elementMatchCount: 0,
      branchMatchCount: 1,
      diagnosticCount: 0,
    },
    selectorBranches: [branch],
    branchMatches: [match],
    indexes: {
      ...emptySelectorReachability().indexes,
      branchReachabilityBySelectorBranchNodeId: new Map([[input.selectorBranchNodeId, branch]]),
      branchReachabilityBySourceKey: new Map([[key, branch]]),
      matchById: new Map([[match.id, match]]),
      matchIdsBySelectorBranchNodeId: new Map([[input.selectorBranchNodeId, input.matchIds]]),
      matchIdsByClassName: new Map(
        input.requiredClassNames.map((className) => [className, input.matchIds]),
      ),
    },
  };
}

function classReference(input) {
  return {
    id: input.id,
    sourceFileId: input.sourceFileId,
    componentId: input.componentId,
    suppliedByComponentId: input.suppliedByComponentId,
    emittedByComponentId: input.emittedByComponentId,
    location: { filePath: "src/App.tsx", startLine: 1, startColumn: 1 },
    origin: "render-ir",
    expressionKind: "exact-string",
    rawExpressionText: input.className,
    definiteClassNames: [input.className],
    possibleClassNames: [],
    unknownDynamic: false,
    confidence: "high",
    traces: [],
    sourceSummary: {},
  };
}

function referenceMatch(input) {
  return {
    id: input.id,
    referenceId: input.referenceId,
    definitionId: input.definitionId,
    className: input.className,
    referenceClassKind: input.referenceClassKind,
    reachability: input.reachability,
    matchKind: "reachable-stylesheet",
    reasons: [],
    traces: [],
  };
}

function emptySelectorReachability() {
  return {
    meta: {
      generatedAtStage: "selector-reachability",
      selectorBranchCount: 0,
      elementMatchCount: 0,
      branchMatchCount: 0,
      diagnosticCount: 0,
    },
    selectorBranches: [],
    elementMatches: [],
    branchMatches: [],
    diagnostics: [],
    indexes: {
      branchReachabilityBySelectorBranchNodeId: new Map(),
      branchReachabilityBySourceKey: new Map(),
      matchById: new Map(),
      elementMatchById: new Map(),
      renderElementById: new Map(),
      emissionSiteById: new Map(),
      renderPathById: new Map(),
      unknownRegionById: new Map(),
      matchIdsBySelectorBranchNodeId: new Map(),
      matchIdsByElementId: new Map(),
      matchIdsByClassName: new Map(),
      matchIdsByEmissionSiteId: new Map(),
      matchIdsByRenderPathId: new Map(),
      matchIdsByPlacementConditionId: new Map(),
      renderPathIdsByElementId: new Map(),
      renderPathIdsByEmissionSiteId: new Map(),
      placementConditionIdsByElementId: new Map(),
      placementConditionIdsByEmissionSiteId: new Map(),
      emissionSiteIdsByElementId: new Map(),
      emissionSiteIdsByToken: new Map(),
      unknownClassElementIds: [],
      unknownClassEmissionSiteIds: [],
      unknownClassEmissionSiteIdsByElementId: new Map(),
      unknownRegionIdsByComponentNodeId: new Map(),
      unknownRegionIdsByRenderPathId: new Map(),
      branchIdsByRequiredClassName: new Map(),
      branchIdsByStylesheetNodeId: new Map(),
      diagnosticIdsBySelectorBranchNodeId: new Map(),
    },
  };
}
