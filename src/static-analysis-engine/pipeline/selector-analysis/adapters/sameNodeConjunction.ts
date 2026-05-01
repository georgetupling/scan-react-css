import type {
  ParsedSelectorQuery,
  SelectorAnalysisTarget,
  SelectorReachabilityEvidence,
  SelectorRenderModelIndex,
  SelectorQueryResult,
} from "../types.js";
import { buildSelectorQueryResult } from "../resultUtils.js";
import { attachMatchedReachability } from "../reachabilityResultUtils.js";
import { selectorBranchSourceKey } from "../../selector-reachability/index.js";
import {
  evaluateElementClassRequirement,
  getScopedElements,
  mergeStructuralEvaluations,
  type StructuralEvaluation,
} from "./renderModelEvaluation.js";

type SameNodeConstraint = Extract<
  ParsedSelectorQuery["constraint"],
  { kind: "same-node-class-conjunction" }
>;

export function analyzeSameNodeClassConjunction(input: {
  selectorQuery: ParsedSelectorQuery;
  constraint: SameNodeConstraint;
  analysisTargets: SelectorAnalysisTarget[];
  renderModelIndex?: SelectorRenderModelIndex;
  selectorReachability?: SelectorReachabilityEvidence;
  includeTraces?: boolean;
}): SelectorQueryResult {
  const includeTraces = input.includeTraces ?? true;
  const stageEvaluation = evaluateAgainstSelectorReachability(input);
  if (stageEvaluation) {
    return stageEvaluation;
  }

  let sawUnsupportedDynamicClass = false;
  let sawPossibleMatch = false;
  const matchedTargets: SelectorAnalysisTarget[] = [];

  for (const analysisTarget of input.analysisTargets) {
    const evaluation = evaluateTargetAgainstEmissionSites({
      analysisTarget,
      classNames: input.constraint.classNames,
      renderModelIndex: input.renderModelIndex,
    });
    if (evaluation === "match") {
      if (analysisTarget.reachabilityAvailability === "possible") {
        sawPossibleMatch = true;
        matchedTargets.push(analysisTarget);
        continue;
      }

      return attachMatchedReachability({
        selectorQuery: input.selectorQuery,
        matchedTargets: [analysisTarget],
        result: buildSelectorQueryResult({
          selectorQuery: input.selectorQuery,
          outcome: "match",
          status: "resolved",
          reasons: [
            `found a rendered element with all required classes: ${input.constraint.classNames.join(", ")}`,
          ],
          certainty: "definite",
          dimensions: { structure: "definite" },
          traces: includeTraces
            ? [
                {
                  traceId: "selector-match:same-node:definite",
                  category: "selector-match",
                  summary: `found a rendered element with all required classes: ${input.constraint.classNames.join(", ")}`,
                  anchor:
                    input.selectorQuery.source.kind === "css-source"
                      ? input.selectorQuery.source.selectorAnchor
                      : undefined,
                  children: [],
                },
              ]
            : [],
          includeTraces,
        }),
        includeTraces,
      });
    }

    if (evaluation === "possible-match") {
      sawPossibleMatch = true;
      matchedTargets.push(analysisTarget);
    }

    if (evaluation === "unsupported") {
      sawUnsupportedDynamicClass = true;
    }
  }

  if (sawPossibleMatch) {
    return attachMatchedReachability({
      selectorQuery: input.selectorQuery,
      matchedTargets,
      result: buildSelectorQueryResult({
        selectorQuery: input.selectorQuery,
        outcome: "possible-match",
        status: "resolved",
        reasons: [
          `at least one rendered element may emit all required classes together: ${input.constraint.classNames.join(", ")}`,
        ],
        certainty: "possible",
        dimensions: { structure: "possible" },
        traces: includeTraces
          ? [
              {
                traceId: "selector-match:same-node:possible",
                category: "selector-match",
                summary: `at least one rendered element may emit all required classes together: ${input.constraint.classNames.join(", ")}`,
                anchor:
                  input.selectorQuery.source.kind === "css-source"
                    ? input.selectorQuery.source.selectorAnchor
                    : undefined,
                children: [],
              },
            ]
          : [],
        includeTraces,
      }),
      includeTraces,
    });
  }

  if (sawUnsupportedDynamicClass) {
    return buildSelectorQueryResult({
      selectorQuery: input.selectorQuery,
      outcome: "possible-match",
      status: "unsupported",
      reasons: [
        "encountered unsupported dynamic class construction while checking same-node class conjunction",
      ],
      certainty: "unknown",
      dimensions: { structure: "unsupported" },
      traces: includeTraces
        ? [
            {
              traceId: "selector-match:same-node:unsupported",
              category: "selector-match",
              summary:
                "encountered unsupported dynamic class construction while checking same-node class conjunction",
              anchor:
                input.selectorQuery.source.kind === "css-source"
                  ? input.selectorQuery.source.selectorAnchor
                  : undefined,
              children: [],
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
    reasons: [
      `no rendered element emitted all required classes together: ${input.constraint.classNames.join(", ")}`,
    ],
    certainty: "definite",
    dimensions: { structure: "not-found-under-bounded-analysis" },
    traces: includeTraces
      ? [
          {
            traceId: "selector-match:same-node:no-match",
            category: "selector-match",
            summary: `no rendered element emitted all required classes together: ${input.constraint.classNames.join(", ")}`,
            anchor:
              input.selectorQuery.source.kind === "css-source"
                ? input.selectorQuery.source.selectorAnchor
                : undefined,
            children: [],
          },
        ]
      : [],
    includeTraces,
  });
}

function evaluateAgainstSelectorReachability(input: {
  selectorQuery: ParsedSelectorQuery;
  constraint: SameNodeConstraint;
  analysisTargets: SelectorAnalysisTarget[];
  selectorReachability?: SelectorReachabilityEvidence;
  includeTraces?: boolean;
}): SelectorQueryResult | undefined {
  if (!input.selectorReachability || input.selectorQuery.source.kind !== "css-source") {
    return undefined;
  }

  const sourceKey = selectorBranchSourceKey({
    ruleKey: input.selectorQuery.source.ruleKey,
    branchIndex: input.selectorQuery.source.branchIndex,
    selectorText: input.selectorQuery.selectorText,
    location: input.selectorQuery.source.selectorAnchor,
  });
  const branch = input.selectorReachability.indexes.branchReachabilityBySourceKey.get(sourceKey);
  if (!branch) {
    return undefined;
  }

  const includeTraces = input.includeTraces ?? true;
  const scopedElementIds = new Map<string, SelectorAnalysisTarget[]>();
  for (const target of input.analysisTargets) {
    for (const elementId of target.elementIds) {
      const targets = scopedElementIds.get(elementId) ?? [];
      targets.push(target);
      scopedElementIds.set(elementId, targets);
    }
  }

  const matches = branch.matchIds
    .map((matchId) => input.selectorReachability?.indexes.matchById.get(matchId))
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .filter((match) => scopedElementIds.has(match.subjectElementId));
  const matchedTargets = uniqueTargets(
    matches.flatMap((match) => scopedElementIds.get(match.subjectElementId) ?? []),
  );
  const hasDefiniteMatch = matches.some((match) => match.certainty === "definite");
  const hasPossibleMatch = matches.some(
    (match) => match.certainty === "possible" || match.certainty === "unknown-context",
  );

  if (
    hasDefiniteMatch &&
    matchedTargets.some((target) => target.reachabilityAvailability === "definite")
  ) {
    return attachMatchedReachability({
      selectorQuery: input.selectorQuery,
      matchedTargets,
      result: buildSelectorQueryResult({
        selectorQuery: input.selectorQuery,
        outcome: "match",
        status: "resolved",
        reasons: [
          `found a rendered element with all required classes: ${input.constraint.classNames.join(", ")}`,
        ],
        certainty: "definite",
        dimensions: { structure: "definite" },
        traces: includeTraces
          ? [
              {
                traceId: "selector-reachability:same-node:definite",
                category: "selector-match",
                summary: `Stage 6 found a rendered element with all required classes: ${input.constraint.classNames.join(", ")}`,
                anchor: input.selectorQuery.source.selectorAnchor,
                children: [],
                metadata: {
                  selectorBranchNodeId: branch.selectorBranchNodeId,
                },
              },
            ]
          : [],
        includeTraces,
      }),
      includeTraces,
    });
  }

  if (hasPossibleMatch || matchedTargets.length > 0) {
    return attachMatchedReachability({
      selectorQuery: input.selectorQuery,
      matchedTargets,
      result: buildSelectorQueryResult({
        selectorQuery: input.selectorQuery,
        outcome: "possible-match",
        status: "resolved",
        reasons: [
          `at least one rendered element may emit all required classes together: ${input.constraint.classNames.join(", ")}`,
        ],
        certainty: "possible",
        dimensions: { structure: "possible" },
        traces: includeTraces
          ? [
              {
                traceId: "selector-reachability:same-node:possible",
                category: "selector-match",
                summary: `Stage 6 found a possible rendered element with all required classes: ${input.constraint.classNames.join(", ")}`,
                anchor: input.selectorQuery.source.selectorAnchor,
                children: [],
                metadata: {
                  selectorBranchNodeId: branch.selectorBranchNodeId,
                },
              },
            ]
          : [],
        includeTraces,
      }),
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
      dimensions: { structure: "unsupported" },
      traces: includeTraces
        ? [
            {
              traceId: "selector-reachability:same-node:unsupported",
              category: "selector-match",
              summary: "Stage 6 could not resolve this selector branch",
              anchor: input.selectorQuery.source.selectorAnchor,
              children: [],
              metadata: {
                selectorBranchNodeId: branch.selectorBranchNodeId,
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
    reasons: [
      `no rendered element emitted all required classes together: ${input.constraint.classNames.join(", ")}`,
    ],
    certainty: "definite",
    dimensions: { structure: "not-found-under-bounded-analysis" },
    traces: includeTraces
      ? [
          {
            traceId: "selector-reachability:same-node:no-match",
            category: "selector-match",
            summary: `Stage 6 found no rendered element with all required classes: ${input.constraint.classNames.join(", ")}`,
            anchor: input.selectorQuery.source.selectorAnchor,
            children: [],
            metadata: {
              selectorBranchNodeId: branch.selectorBranchNodeId,
            },
          },
        ]
      : [],
    includeTraces,
  });
}

function evaluateTargetAgainstEmissionSites(input: {
  analysisTarget: SelectorAnalysisTarget;
  classNames: string[];
  renderModelIndex?: SelectorRenderModelIndex;
}): StructuralEvaluation {
  if (!input.renderModelIndex) {
    return "no-match";
  }

  return mergeStructuralEvaluations(
    getScopedElements(input.analysisTarget, input.renderModelIndex).map((element) =>
      evaluateElementClassRequirement({
        renderModelIndex: input.renderModelIndex as SelectorRenderModelIndex,
        elementId: element.id,
        classNames: input.classNames,
      }),
    ),
  );
}

function uniqueTargets(targets: SelectorAnalysisTarget[]): SelectorAnalysisTarget[] {
  const byId = new Map<string, SelectorAnalysisTarget>();
  for (const target of targets) {
    byId.set(target.targetId, target);
  }
  return [...byId.values()].sort((left, right) => left.targetId.localeCompare(right.targetId));
}
