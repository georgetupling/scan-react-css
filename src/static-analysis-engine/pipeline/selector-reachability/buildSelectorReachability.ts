import type { AnalysisConfidence } from "../../types/analysis.js";
import type { SelectorBranchNode } from "../fact-graph/index.js";
import type { RenderStructureResult } from "../render-structure/index.js";
import { matchElementClassRequirement } from "./elementRequirementMatcher.js";
import {
  selectorBranchMatchId,
  selectorElementMatchId,
  selectorReachabilityDiagnosticId,
} from "./ids.js";
import { buildSelectorRenderMatchIndexes } from "./renderMatchIndexes.js";
import type {
  SelectorBranchMatch,
  SelectorBranchReachability,
  SelectorElementMatch,
  SelectorReachabilityDiagnostic,
  SelectorReachabilityIndexes,
  SelectorReachabilityResult,
  SelectorReachabilityStatus,
} from "./types.js";

export function buildSelectorReachability(
  input: RenderStructureResult,
): SelectorReachabilityResult {
  const renderIndexes = buildSelectorRenderMatchIndexes(input.renderModel);
  const selectorBranches: SelectorBranchReachability[] = [];
  const elementMatches: SelectorElementMatch[] = [];
  const branchMatches: SelectorBranchMatch[] = [];
  const diagnostics: SelectorReachabilityDiagnostic[] = [];

  for (const branch of [...input.graph.nodes.selectorBranches].sort(compareSelectorBranches)) {
    const branchDiagnostics = buildDiagnostics(branch);
    diagnostics.push(...branchDiagnostics);

    const branchElementMatches: SelectorElementMatch[] = [];
    if (branch.subjectClassNames.length > 0 && branchDiagnostics.length === 0) {
      const candidateElementIds = getCandidateElementIds({
        branch,
        elementIdsByClassName: renderIndexes.elementIdsByClassName,
      });

      for (const elementId of candidateElementIds) {
        const match = matchElementClassRequirement({
          indexes: renderIndexes,
          elementId,
          classNames: branch.subjectClassNames,
        });
        if (match.certainty === "impossible") {
          continue;
        }

        branchElementMatches.push({
          id: selectorElementMatchId({
            selectorBranchNodeId: branch.id,
            elementId,
          }),
          selectorBranchNodeId: branch.id,
          elementId,
          requirement: {
            requiredClassNames: uniqueSorted(branch.subjectClassNames),
            unsupportedParts: [],
          },
          matchedClassNames: match.matchedClassNames,
          supportingEmissionSiteIds: match.supportingEmissionSiteIds,
          certainty: match.certainty,
          confidence: match.certainty === "definite" ? "high" : "medium",
        });
      }
    }

    for (const elementMatch of branchElementMatches) {
      elementMatches.push(elementMatch);
      const element = input.renderModel.indexes.elementById.get(elementMatch.elementId);
      if (!element) {
        continue;
      }

      branchMatches.push({
        id: selectorBranchMatchId({
          selectorBranchNodeId: branch.id,
          elementId: elementMatch.elementId,
        }),
        selectorBranchNodeId: branch.id,
        subjectElementId: elementMatch.elementId,
        elementMatchIds: [elementMatch.id],
        supportingEmissionSiteIds: elementMatch.supportingEmissionSiteIds,
        requiredClassNames: uniqueSorted(branch.subjectClassNames),
        matchedClassNames: elementMatch.matchedClassNames,
        renderPathIds: [element.renderPathId],
        placementConditionIds: uniqueSorted(element.placementConditionIds),
        certainty: elementMatch.certainty,
        confidence: elementMatch.confidence,
        traces: [],
      });
    }

    const matchIds = branchMatches
      .filter((match) => match.selectorBranchNodeId === branch.id)
      .map((match) => match.id)
      .sort((left, right) => left.localeCompare(right));
    selectorBranches.push({
      selectorBranchNodeId: branch.id,
      selectorNodeId: branch.selectorNodeId,
      ...(branch.ruleDefinitionNodeId ? { ruleDefinitionNodeId: branch.ruleDefinitionNodeId } : {}),
      ...(branch.stylesheetNodeId ? { stylesheetNodeId: branch.stylesheetNodeId } : {}),
      branchText: branch.selectorText,
      selectorListText: branch.selectorListText,
      branchIndex: branch.branchIndex,
      branchCount: branch.branchCount,
      ruleKey: branch.ruleKey,
      subject: {
        requiredClassNames: uniqueSorted(branch.subjectClassNames),
        unsupportedParts: branchDiagnostics.map((diagnostic) => ({
          reason: diagnostic.message,
          ...(diagnostic.location ? { location: diagnostic.location } : {}),
        })),
      },
      status: getBranchStatus(branchDiagnostics, branchElementMatches),
      confidence: getBranchConfidence(branchDiagnostics, branchElementMatches),
      matchIds,
      diagnosticIds: branchDiagnostics.map((diagnostic) => diagnostic.id),
      ...(branch.location ? { location: branch.location } : {}),
      traces: [],
    });
  }

  const indexes = buildIndexes({
    selectorBranches,
    elementMatches,
    branchMatches,
    diagnostics,
  });

  return {
    meta: {
      generatedAtStage: "selector-reachability",
      selectorBranchCount: selectorBranches.length,
      elementMatchCount: elementMatches.length,
      branchMatchCount: branchMatches.length,
      diagnosticCount: diagnostics.length,
    },
    selectorBranches,
    elementMatches,
    branchMatches,
    diagnostics,
    indexes,
  };
}

function buildDiagnostics(branch: SelectorBranchNode): SelectorReachabilityDiagnostic[] {
  if (!branch.hasUnknownSemantics) {
    return [];
  }

  return [
    {
      id: selectorReachabilityDiagnosticId({
        selectorBranchNodeId: branch.id,
        code: "unsupported-selector-branch",
      }),
      selectorBranchNodeId: branch.id,
      severity: "debug",
      code: "unsupported-selector-branch",
      message: "selector branch contains unsupported selector semantics",
      ...(branch.location ? { location: branch.location } : {}),
      traces: [],
    },
  ];
}

function getCandidateElementIds(input: {
  branch: SelectorBranchNode;
  elementIdsByClassName: Map<string, string[]>;
}): string[] {
  const classNames = uniqueSorted(input.branch.subjectClassNames);
  if (classNames.length === 0) {
    return [];
  }

  const [firstClassName, ...restClassNames] = classNames;
  let candidates = new Set(input.elementIdsByClassName.get(firstClassName) ?? []);
  for (const className of restClassNames) {
    const elementIds = new Set(input.elementIdsByClassName.get(className) ?? []);
    candidates = new Set([...candidates].filter((elementId) => elementIds.has(elementId)));
  }

  return [...candidates].sort((left, right) => left.localeCompare(right));
}

function getBranchStatus(
  diagnostics: SelectorReachabilityDiagnostic[],
  matches: SelectorElementMatch[],
): SelectorReachabilityStatus {
  if (diagnostics.length > 0) {
    return "unsupported";
  }

  if (matches.some((match) => match.certainty === "definite")) {
    return "definitely-matchable";
  }

  if (matches.some((match) => match.certainty === "possible")) {
    return "possibly-matchable";
  }

  if (matches.some((match) => match.certainty === "unknown-context")) {
    return "only-matches-in-unknown-context";
  }

  return "not-matchable";
}

function getBranchConfidence(
  diagnostics: SelectorReachabilityDiagnostic[],
  matches: SelectorElementMatch[],
): AnalysisConfidence {
  if (diagnostics.length > 0) {
    return "low";
  }

  if (matches.some((match) => match.certainty === "definite")) {
    return "high";
  }

  if (matches.length > 0) {
    return "medium";
  }

  return "high";
}

function buildIndexes(input: {
  selectorBranches: SelectorBranchReachability[];
  elementMatches: SelectorElementMatch[];
  branchMatches: SelectorBranchMatch[];
  diagnostics: SelectorReachabilityDiagnostic[];
}): SelectorReachabilityIndexes {
  const branchReachabilityBySelectorBranchNodeId = new Map<string, SelectorBranchReachability>();
  const branchReachabilityBySourceKey = new Map<string, SelectorBranchReachability>();
  const matchById = new Map<string, SelectorBranchMatch>();
  const elementMatchById = new Map<string, SelectorElementMatch>();
  const matchIdsBySelectorBranchNodeId = new Map<string, string[]>();
  const matchIdsByElementId = new Map<string, string[]>();
  const matchIdsByClassName = new Map<string, string[]>();
  const branchIdsByRequiredClassName = new Map<string, string[]>();
  const branchIdsByStylesheetNodeId = new Map<string, string[]>();
  const diagnosticIdsBySelectorBranchNodeId = new Map<string, string[]>();

  for (const branch of input.selectorBranches) {
    branchReachabilityBySelectorBranchNodeId.set(branch.selectorBranchNodeId, branch);
    branchReachabilityBySourceKey.set(selectorBranchSourceKeyFromReachability(branch), branch);

    for (const className of branch.subject.requiredClassNames) {
      pushMapValue(branchIdsByRequiredClassName, className, branch.selectorBranchNodeId);
    }

    if (branch.stylesheetNodeId) {
      pushMapValue(
        branchIdsByStylesheetNodeId,
        branch.stylesheetNodeId,
        branch.selectorBranchNodeId,
      );
    }
  }

  for (const elementMatch of input.elementMatches) {
    elementMatchById.set(elementMatch.id, elementMatch);
  }

  for (const match of input.branchMatches) {
    matchById.set(match.id, match);
    pushMapValue(matchIdsBySelectorBranchNodeId, match.selectorBranchNodeId, match.id);
    pushMapValue(matchIdsByElementId, match.subjectElementId, match.id);
    for (const className of match.requiredClassNames) {
      pushMapValue(matchIdsByClassName, className, match.id);
    }
  }

  for (const diagnostic of input.diagnostics) {
    pushMapValue(
      diagnosticIdsBySelectorBranchNodeId,
      diagnostic.selectorBranchNodeId,
      diagnostic.id,
    );
  }

  [
    matchIdsBySelectorBranchNodeId,
    matchIdsByElementId,
    matchIdsByClassName,
    branchIdsByRequiredClassName,
    branchIdsByStylesheetNodeId,
    diagnosticIdsBySelectorBranchNodeId,
  ].forEach(sortMapValues);

  return {
    branchReachabilityBySelectorBranchNodeId,
    branchReachabilityBySourceKey,
    matchById,
    elementMatchById,
    matchIdsBySelectorBranchNodeId,
    matchIdsByElementId,
    matchIdsByClassName,
    branchIdsByRequiredClassName,
    branchIdsByStylesheetNodeId,
    diagnosticIdsBySelectorBranchNodeId,
  };
}

function selectorBranchSourceKeyFromReachability(branch: SelectorBranchReachability): string {
  return [
    branch.ruleKey,
    branch.branchIndex,
    branch.branchText,
    branch.location ? anchorKey(branch.location) : "",
  ].join(":");
}

function compareSelectorBranches(left: SelectorBranchNode, right: SelectorBranchNode): number {
  return (
    (left.location?.filePath ?? "").localeCompare(right.location?.filePath ?? "") ||
    (left.location?.startLine ?? 0) - (right.location?.startLine ?? 0) ||
    (left.location?.startColumn ?? 0) - (right.location?.startColumn ?? 0) ||
    left.ruleKey.localeCompare(right.ruleKey) ||
    left.branchIndex - right.branchIndex ||
    left.id.localeCompare(right.id)
  );
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function anchorKey(anchor: {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine?: number;
  endColumn?: number;
}): string {
  return [
    anchor.filePath.replace(/\\/g, "/"),
    anchor.startLine,
    anchor.startColumn,
    anchor.endLine ?? "",
    anchor.endColumn ?? "",
  ].join(":");
}
