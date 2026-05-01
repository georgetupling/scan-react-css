import type {
  ReachabilitySummary,
  StylesheetReachabilityContextRecord,
} from "../reachability/types.js";
import type {
  ParsedSelectorQuery,
  SelectorAnalysisTarget,
  SelectorRenderModelIndex,
  SelectorQueryResult,
  SelectorReachabilityEvidence,
} from "./types.js";
import type { RenderModel, RenderPathSegment } from "../render-structure/types.js";
import type {
  SelectorBranchMatch,
  SelectorBranchReachability,
} from "../selector-reachability/types.js";
import { selectorBranchSourceKey } from "../selector-reachability/index.js";
import { buildSelectorQueryResult } from "./resultUtils.js";
import { attachMatchedReachability } from "./reachabilityResultUtils.js";

type AvailableContextRecord = StylesheetReachabilityContextRecord & {
  availability: "definite" | "possible";
};

type RenderRegionContext = Extract<
  StylesheetReachabilityContextRecord["context"],
  { kind: "render-region" }
>;

type ProjectedRenderPathSegment = RenderRegionContext["path"][number];

type ReachabilityTargetResolution = {
  result?: SelectorQueryResult;
  analysisTargets: SelectorAnalysisTarget[];
};

export function analyzeSelectorQueries(input: {
  selectorQueries: ParsedSelectorQuery[];
  renderModel: RenderModel;
  reachabilitySummary?: ReachabilitySummary;
  selectorReachability?: SelectorReachabilityEvidence;
  includeTraces?: boolean;
}): SelectorQueryResult[] {
  const includeTraces = input.includeTraces ?? true;
  const reachabilityTargetCache = new Map<string, SelectorAnalysisTarget[]>();
  const renderModelIndex = buildSelectorRenderModelIndex(input.renderModel);

  return input.selectorQueries.map((selectorQuery) =>
    analyzeSelectorQuery({
      selectorQuery,
      renderModelIndex,
      reachabilitySummary: input.reachabilitySummary,
      selectorReachability: input.selectorReachability,
      reachabilityTargetCache,
      includeTraces,
    }),
  );
}

function analyzeSelectorQuery(input: {
  selectorQuery: ParsedSelectorQuery;
  renderModelIndex: SelectorRenderModelIndex;
  reachabilitySummary?: ReachabilitySummary;
  selectorReachability?: SelectorReachabilityEvidence;
  reachabilityTargetCache: Map<string, SelectorAnalysisTarget[]>;
  includeTraces: boolean;
}): SelectorQueryResult {
  const { constraint } = input.selectorQuery;
  let analysisTargets = buildWholeModelAnalysisTargets(input.renderModelIndex.renderModel);

  if (input.selectorQuery.source.kind === "css-source") {
    const reachabilityResolution = resolveQueryReachability(input);
    if (reachabilityResolution.result) {
      return reachabilityResolution.result;
    }

    analysisTargets = reachabilityResolution.analysisTargets;
  }

  if ("kind" in constraint && constraint.kind === "unsupported") {
    return buildSelectorQueryResult({
      selectorQuery: input.selectorQuery,
      outcome: "possible-match",
      status: "unsupported",
      reasons: [
        `unsupported selector query: ${constraint.reason}`,
        ...input.selectorQuery.parseNotes,
      ],
      certainty: "unknown",
      dimensions: {
        structure: "unsupported",
      },
      traces: input.includeTraces
        ? [
            {
              traceId: "selector-match:unsupported-selector-shape",
              category: "selector-match",
              summary: `unsupported selector query: ${constraint.reason}`,
              anchor:
                input.selectorQuery.source.kind === "css-source"
                  ? input.selectorQuery.source.selectorAnchor
                  : undefined,
              children: input.selectorQuery.parseTraces,
              metadata: {
                selectorText: input.selectorQuery.selectorText,
              },
            },
          ]
        : [],
      includeTraces: input.includeTraces,
    });
  }

  return analyzeSelectorReachabilityBranch({
    selectorQuery: input.selectorQuery,
    analysisTargets,
    selectorReachability: input.selectorReachability,
    includeTraces: input.includeTraces,
  });
}

function analyzeSelectorReachabilityBranch(input: {
  selectorQuery: ParsedSelectorQuery;
  analysisTargets: SelectorAnalysisTarget[];
  selectorReachability?: SelectorReachabilityEvidence;
  includeTraces: boolean;
}): SelectorQueryResult {
  const includeTraces = input.includeTraces ?? true;
  const anchor =
    input.selectorQuery.source.kind === "css-source"
      ? input.selectorQuery.source.selectorAnchor
      : undefined;
  const branch = getSelectorReachabilityBranch(input);

  if (!branch) {
    return buildSelectorQueryResult({
      selectorQuery: input.selectorQuery,
      outcome: "possible-match",
      status: "unsupported",
      reasons: ["selector reachability evidence is unavailable for this selector query"],
      certainty: "unknown",
      dimensions: {
        structure: "unsupported",
      },
      traces: includeTraces
        ? [
            {
              traceId: "selector-reachability:missing-branch",
              category: "selector-match",
              summary: "selector reachability evidence is unavailable for this selector query",
              anchor,
              children: input.selectorQuery.parseTraces,
              metadata: {
                selectorText: input.selectorQuery.selectorText,
              },
            },
          ]
        : [],
      includeTraces,
    });
  }

  if (branch.status === "unsupported") {
    return buildSelectorQueryResult({
      selectorQuery: input.selectorQuery,
      outcome: "possible-match",
      status: "unsupported",
      reasons: ["selector branch contains unsupported selector semantics"],
      certainty: "unknown",
      dimensions: {
        structure: "unsupported",
      },
      traces: includeTraces
        ? [
            {
              traceId: "selector-reachability:unsupported",
              category: "selector-match",
              summary: "Stage 6 could not resolve this selector branch",
              anchor,
              children: branch.traces,
              metadata: {
                selectorBranchNodeId: branch.selectorBranchNodeId,
              },
            },
          ]
        : [],
      includeTraces,
    });
  }

  const scopedMatches = getScopedSelectorBranchMatches({
    branch,
    selectorReachability: input.selectorReachability,
    analysisTargets: input.analysisTargets,
  });
  const matchedTargets = getMatchedTargets({
    matches: scopedMatches,
    analysisTargets: input.analysisTargets,
  });
  const matchSummary = summarizeMatches(scopedMatches, matchedTargets);

  if (matchSummary.hasDefiniteMatch) {
    return attachMatchedReachability({
      selectorQuery: input.selectorQuery,
      matchedTargets,
      result: buildSelectorQueryResult({
        selectorQuery: input.selectorQuery,
        outcome: "match",
        status: "resolved",
        reasons: [buildMatchReason(input.selectorQuery, "definite")],
        certainty: "definite",
        dimensions: { structure: "definite" },
        traces: includeTraces
          ? [
              {
                traceId: "selector-reachability:definite",
                category: "selector-match",
                summary: buildMatchReason(input.selectorQuery, "definite"),
                anchor,
                children: branch.traces,
                metadata: {
                  selectorBranchNodeId: branch.selectorBranchNodeId,
                  matchCount: scopedMatches.length,
                },
              },
            ]
          : [],
        includeTraces,
      }),
      includeTraces,
    });
  }

  if (matchSummary.hasPossibleMatch) {
    return attachMatchedReachability({
      selectorQuery: input.selectorQuery,
      matchedTargets,
      result: buildSelectorQueryResult({
        selectorQuery: input.selectorQuery,
        outcome: "possible-match",
        status: "resolved",
        reasons: [buildMatchReason(input.selectorQuery, "possible")],
        certainty: "possible",
        dimensions: { structure: "possible" },
        traces: includeTraces
          ? [
              {
                traceId: "selector-reachability:possible",
                category: "selector-match",
                summary: buildMatchReason(input.selectorQuery, "possible"),
                anchor,
                children: branch.traces,
                metadata: {
                  selectorBranchNodeId: branch.selectorBranchNodeId,
                  matchCount: scopedMatches.length,
                },
              },
            ]
          : [],
        includeTraces,
      }),
      includeTraces,
    });
  }

  if (matchSummary.hasUnknownContextMatch) {
    return buildSelectorQueryResult({
      selectorQuery: input.selectorQuery,
      outcome: "possible-match",
      status: "unsupported",
      reasons: ["selector can only match through unknown render or class context"],
      certainty: "unknown",
      dimensions: { structure: "unsupported" },
      traces: includeTraces
        ? [
            {
              traceId: "selector-reachability:unknown-context",
              category: "selector-match",
              summary: "Stage 6 found this selector can only match through unknown context",
              anchor,
              children: branch.traces,
              metadata: {
                selectorBranchNodeId: branch.selectorBranchNodeId,
                matchCount: scopedMatches.length,
              },
            },
          ]
        : [],
      includeTraces,
    });
  }

  return buildSelectorQueryResult({
    selectorQuery: input.selectorQuery,
    outcome: "no-match-under-bounded-analysis",
    status: "resolved",
    reasons: [buildNoMatchReason(input.selectorQuery, branch, scopedMatches.length)],
    certainty: "definite",
    dimensions: { structure: "not-found-under-bounded-analysis" },
    traces: includeTraces
      ? [
          {
            traceId: "selector-reachability:no-match",
            category: "selector-match",
            summary: buildNoMatchReason(input.selectorQuery, branch, scopedMatches.length),
            anchor,
            children: branch.traces,
            metadata: {
              selectorBranchNodeId: branch.selectorBranchNodeId,
              globalMatchCount: branch.matchIds.length,
              scopedMatchCount: scopedMatches.length,
            },
          },
        ]
      : [],
    includeTraces,
  });
}

function getSelectorReachabilityBranch(input: {
  selectorQuery: ParsedSelectorQuery;
  selectorReachability?: SelectorReachabilityEvidence;
}): SelectorBranchReachability | undefined {
  if (!input.selectorReachability || input.selectorQuery.source.kind !== "css-source") {
    return undefined;
  }

  return input.selectorReachability.indexes.branchReachabilityBySourceKey.get(
    selectorBranchSourceKey({
      ruleKey: input.selectorQuery.source.ruleKey,
      branchIndex: input.selectorQuery.source.branchIndex,
      selectorText: input.selectorQuery.selectorText,
      location: input.selectorQuery.source.selectorAnchor,
    }),
  );
}

function getScopedSelectorBranchMatches(input: {
  branch: SelectorBranchReachability;
  selectorReachability?: SelectorReachabilityEvidence;
  analysisTargets: SelectorAnalysisTarget[];
}): SelectorBranchMatch[] {
  if (!input.selectorReachability) {
    return [];
  }

  const scopedElementIds = new Set(
    input.analysisTargets.flatMap((analysisTarget) => analysisTarget.elementIds),
  );
  return input.branch.matchIds
    .map((matchId) => input.selectorReachability?.indexes.matchById.get(matchId))
    .filter((match): match is SelectorBranchMatch => Boolean(match))
    .filter((match) => scopedElementIds.has(match.subjectElementId));
}

function getMatchedTargets(input: {
  matches: SelectorBranchMatch[];
  analysisTargets: SelectorAnalysisTarget[];
}): SelectorAnalysisTarget[] {
  const targetsById = new Map<string, SelectorAnalysisTarget>();
  for (const match of input.matches) {
    for (const target of input.analysisTargets) {
      if (target.elementIds.includes(match.subjectElementId)) {
        targetsById.set(target.targetId, target);
      }
    }
  }

  return [...targetsById.values()].sort((left, right) =>
    left.targetId.localeCompare(right.targetId),
  );
}

function summarizeMatches(
  matches: SelectorBranchMatch[],
  matchedTargets: SelectorAnalysisTarget[],
): {
  hasDefiniteMatch: boolean;
  hasPossibleMatch: boolean;
  hasUnknownContextMatch: boolean;
} {
  return {
    hasDefiniteMatch:
      matches.some((match) => match.certainty === "definite") &&
      matchedTargets.some((target) => target.reachabilityAvailability === "definite"),
    hasPossibleMatch:
      matches.some((match) => match.certainty === "possible") ||
      (matches.some((match) => match.certainty === "definite") &&
        matchedTargets.some((target) => target.reachabilityAvailability === "possible")),
    hasUnknownContextMatch: matches.some((match) => match.certainty === "unknown-context"),
  };
}

function buildMatchReason(
  selectorQuery: ParsedSelectorQuery,
  certainty: "definite" | "possible",
): string {
  return certainty === "definite"
    ? `Stage 6 found a rendered selector match for "${selectorQuery.selectorText}"`
    : `Stage 6 found a possible rendered selector match for "${selectorQuery.selectorText}"`;
}

function buildNoMatchReason(
  selectorQuery: ParsedSelectorQuery,
  branch: SelectorBranchReachability,
  scopedMatchCount: number,
): string {
  if (branch.matchIds.length > 0 && scopedMatchCount === 0) {
    return `Stage 6 found selector matches for "${selectorQuery.selectorText}", but not in stylesheet-reachable render contexts`;
  }

  return `Stage 6 found no rendered selector match for "${selectorQuery.selectorText}"`;
}

function buildSelectorRenderModelIndex(renderModel: RenderModel): SelectorRenderModelIndex {
  const componentKeyByNodeId = new Map(
    renderModel.components
      .filter((component) => component.componentNodeId)
      .map((component) => [component.componentNodeId as string, component.componentKey]),
  );
  return {
    renderModel,
    componentKeyByNodeId,
    componentNodeIdByComponentKey: new Map(
      renderModel.components
        .filter((component) => component.componentNodeId)
        .map((component) => [component.componentKey, component.componentNodeId as string]),
    ),
  };
}

function resolveQueryReachability(input: {
  selectorQuery: ParsedSelectorQuery;
  renderModelIndex: SelectorRenderModelIndex;
  reachabilitySummary?: ReachabilitySummary;
  reachabilityTargetCache: Map<string, SelectorAnalysisTarget[]>;
  includeTraces: boolean;
}): ReachabilityTargetResolution {
  if (input.selectorQuery.source.kind !== "css-source") {
    return {
      analysisTargets: buildWholeModelAnalysisTargets(input.renderModelIndex.renderModel),
    };
  }

  const cssFilePath = input.selectorQuery.source.selectorAnchor?.filePath;
  const cacheKey = cssFilePath ? normalizeProjectPath(cssFilePath) : undefined;
  const cachedAnalysisTargets = cacheKey ? input.reachabilityTargetCache.get(cacheKey) : undefined;
  if (cachedAnalysisTargets) {
    return {
      analysisTargets: cachedAnalysisTargets,
    };
  }

  const reachabilityRecord = input.reachabilitySummary?.stylesheets.find(
    (stylesheet) => stylesheet.cssFilePath === cssFilePath,
  );

  if (!reachabilityRecord) {
    return {
      result: buildSelectorQueryResult({
        selectorQuery: input.selectorQuery,
        outcome: "possible-match",
        status: "unsupported",
        reasons: ["could not determine stylesheet reachability for this selector source"],
        certainty: "unknown",
        dimensions: {
          reachability: "unsupported",
        },
        traces: input.includeTraces
          ? [
              {
                traceId: "selector-reachability:missing-record",
                category: "reachability",
                summary: "could not determine stylesheet reachability for this selector source",
                anchor: input.selectorQuery.source.selectorAnchor,
                children: [],
                metadata: {
                  cssFilePath,
                },
              },
            ]
          : [],
        includeTraces: input.includeTraces,
        reachability: {
          kind: "css-source",
          cssFilePath,
          availability: "unknown",
          contexts: [],
          reasons: ["no reachability record exists for this stylesheet source"],
        },
      }),
      analysisTargets: [],
    };
  }

  if (reachabilityRecord.availability === "unknown") {
    return {
      result: buildSelectorQueryResult({
        selectorQuery: input.selectorQuery,
        outcome: "possible-match",
        status: "unsupported",
        reasons: ["stylesheet reachability is unknown for this selector source"],
        certainty: "unknown",
        dimensions: {
          reachability: "unknown",
        },
        traces: input.includeTraces
          ? [
              {
                traceId: "selector-reachability:unknown",
                category: "reachability",
                summary: "stylesheet reachability is unknown for this selector source",
                anchor: input.selectorQuery.source.selectorAnchor,
                children: reachabilityRecord.traces ?? [],
                metadata: {
                  cssFilePath: reachabilityRecord.cssFilePath,
                },
              },
            ]
          : [],
        includeTraces: input.includeTraces,
        reachability: {
          kind: "css-source",
          cssFilePath: reachabilityRecord.cssFilePath,
          availability: reachabilityRecord.availability,
          contexts: reachabilityRecord.contexts,
          reasons: reachabilityRecord.reasons,
        },
      }),
      analysisTargets: [],
    };
  }

  if (reachabilityRecord.availability === "unavailable") {
    return {
      result: buildSelectorQueryResult({
        selectorQuery: input.selectorQuery,
        outcome: "no-match-under-bounded-analysis",
        status: "resolved",
        reasons: [
          "stylesheet is not reachable from any analyzed source file or propagated render context",
        ],
        certainty: "definite",
        dimensions: {
          structure: "not-found-under-bounded-analysis",
          reachability: "unavailable",
        },
        traces: input.includeTraces
          ? [
              {
                traceId: "selector-reachability:unavailable",
                category: "reachability",
                summary:
                  "stylesheet is not reachable from any analyzed source file or propagated render context",
                anchor: input.selectorQuery.source.selectorAnchor,
                children: reachabilityRecord.traces ?? [],
                metadata: {
                  cssFilePath: reachabilityRecord.cssFilePath,
                },
              },
            ]
          : [],
        includeTraces: input.includeTraces,
        reachability: {
          kind: "css-source",
          cssFilePath: reachabilityRecord.cssFilePath,
          availability: reachabilityRecord.availability,
          contexts: reachabilityRecord.contexts,
          reasons: reachabilityRecord.reasons,
        },
      }),
      analysisTargets: [],
    };
  }

  const analysisTargets = buildReachabilityAnalysisTargets({
    renderModelIndex: input.renderModelIndex,
    contexts: reachabilityRecord.contexts,
  });

  if (cacheKey) {
    input.reachabilityTargetCache.set(cacheKey, analysisTargets);
  }

  return {
    analysisTargets,
  };
}

function buildWholeModelAnalysisTargets(renderModel: RenderModel): SelectorAnalysisTarget[] {
  const elementIds = renderModel.elements.map((element) => element.id);
  return elementIds.length > 0
    ? [
        {
          targetId: "direct-query:whole-render-model",
          elementIds,
          reachabilityAvailability: "definite",
          reachabilityContexts: [],
        },
      ]
    : [];
}

function buildReachabilityAnalysisTargets(input: {
  renderModelIndex: SelectorRenderModelIndex;
  contexts: StylesheetReachabilityContextRecord[];
}): SelectorAnalysisTarget[] {
  const targetByKey = new Map<string, SelectorAnalysisTarget>();

  for (const context of input.contexts) {
    if (!isAvailableContextRecord(context)) {
      continue;
    }

    const elementIds = resolveElementIdsForContext(input.renderModelIndex, context);
    if (elementIds.length === 0) {
      continue;
    }

    const key = elementIds.join(",");
    const existing = targetByKey.get(key);
    if (existing) {
      existing.reachabilityContexts.push(context);
      if (context.availability === "definite") {
        existing.reachabilityAvailability = "definite";
      }
      continue;
    }

    targetByKey.set(key, {
      targetId: `reachability:${targetByKey.size + 1}`,
      elementIds,
      reachabilityAvailability: context.availability,
      reachabilityContexts: [context],
    });
  }

  return [...targetByKey.values()].sort((left, right) =>
    left.targetId.localeCompare(right.targetId),
  );
}

function isAvailableContextRecord(
  context: StylesheetReachabilityContextRecord,
): context is AvailableContextRecord {
  return context.availability === "definite" || context.availability === "possible";
}

function resolveElementIdsForContext(
  index: SelectorRenderModelIndex,
  contextRecord: AvailableContextRecord,
): string[] {
  const context = contextRecord.context;
  if (context.kind === "source-file") {
    return getElementIdsForSourceFile(index, context.filePath);
  }

  if (context.kind === "component" || context.kind === "render-subtree-root") {
    const componentKey = resolveComponentKey(index, context);
    return componentKey ? getElementIdsForComponentKey(index, componentKey) : [];
  }

  const componentKey = resolveComponentKey(index, context);
  if (!componentKey) {
    return [];
  }

  const regionElementIds = getElementIdsForRenderRegion(index, componentKey, context.path);
  return regionElementIds.length > 0
    ? regionElementIds
    : getElementIdsForComponentKey(index, componentKey);
}

function getElementIdsForSourceFile(index: SelectorRenderModelIndex, filePath: string): string[] {
  const normalizedPath = normalizeProjectPath(filePath);
  const componentKeys = index.renderModel.components
    .filter((component) => normalizeProjectPath(component.filePath) === normalizedPath)
    .map((component) => component.componentKey);
  return deduplicateElementIds(
    componentKeys.flatMap((componentKey) => getElementIdsForComponentKey(index, componentKey)),
  );
}

function getElementIdsForComponentKey(
  index: SelectorRenderModelIndex,
  componentKey: string,
): string[] {
  return deduplicateElementIds(
    index.renderModel.elements
      .filter((element) => elementBelongsToRootComponent(index, element.id, componentKey))
      .map((element) => element.id),
  );
}

function getElementIdsForRenderRegion(
  index: SelectorRenderModelIndex,
  componentKey: string,
  contextPath: RenderRegionContext["path"],
): string[] {
  return deduplicateElementIds(
    index.renderModel.elements
      .filter((element) => {
        if (!elementBelongsToRootComponent(index, element.id, componentKey)) {
          return false;
        }

        const renderPath = index.renderModel.indexes.renderPathById.get(element.renderPathId);
        if (!renderPath) {
          return false;
        }

        return pathStartsWith(projectLegacyPath(renderPath.segments), contextPath);
      })
      .map((element) => element.id),
  );
}

function elementBelongsToRootComponent(
  index: SelectorRenderModelIndex,
  elementId: string,
  componentKey: string,
): boolean {
  const element = index.renderModel.indexes.elementById.get(elementId);
  if (!element) {
    return false;
  }

  const renderPath = index.renderModel.indexes.renderPathById.get(element.renderPathId);
  const rootComponentKey = renderPath?.rootComponentNodeId
    ? index.componentKeyByNodeId.get(renderPath.rootComponentNodeId)
    : undefined;
  if (rootComponentKey) {
    return rootComponentKey === componentKey;
  }

  const placementComponentKey = element.placementComponentNodeId
    ? index.componentKeyByNodeId.get(element.placementComponentNodeId)
    : undefined;
  if (placementComponentKey) {
    return placementComponentKey === componentKey;
  }

  const emittingComponentKey = element.emittingComponentNodeId
    ? index.componentKeyByNodeId.get(element.emittingComponentNodeId)
    : undefined;
  return emittingComponentKey === componentKey;
}

function resolveComponentKey(
  index: SelectorRenderModelIndex,
  context: Extract<
    StylesheetReachabilityContextRecord["context"],
    { kind: "component" | "render-subtree-root" | "render-region" }
  >,
): string | undefined {
  if (context.componentKey) {
    return context.componentKey;
  }

  const normalizedPath = normalizeProjectPath(context.filePath);
  return index.renderModel.components.find(
    (component) =>
      normalizeProjectPath(component.filePath) === normalizedPath &&
      component.componentName === context.componentName,
  )?.componentKey;
}

function projectLegacyPath(segments: RenderPathSegment[]): ProjectedRenderPathSegment[] {
  const result: ProjectedRenderPathSegment[] = [{ kind: "root" }];
  for (const segment of segments) {
    if (segment.kind === "child-index") {
      result.push({ kind: "fragment-child", childIndex: segment.index });
      continue;
    }
    if (segment.kind === "conditional-branch") {
      result.push({ kind: "conditional-branch", branch: segment.branch });
      continue;
    }
    if (segment.kind === "repeated-template") {
      result.push({ kind: "repeated-template" });
      continue;
    }
  }
  return result;
}

function pathStartsWith(
  candidate: ProjectedRenderPathSegment[],
  prefix: ProjectedRenderPathSegment[],
): boolean {
  if (prefix.length > candidate.length) {
    return false;
  }

  return prefix.every(
    (segment, index) => serializePathSegment(segment) === serializePathSegment(candidate[index]),
  );
}

function serializePathSegment(segment: ProjectedRenderPathSegment): string {
  if (segment.kind === "fragment-child") {
    return `${segment.kind}:${segment.childIndex ?? ""}`;
  }
  if (segment.kind === "conditional-branch") {
    return `${segment.kind}:${segment.branch ?? ""}`;
  }
  return segment.kind;
}

function deduplicateElementIds(elementIds: string[]): string[] {
  return [...new Set(elementIds)].sort((left, right) => left.localeCompare(right));
}

function normalizeProjectPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
