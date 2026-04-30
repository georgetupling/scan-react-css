import type { RenderNode } from "../../render-model/render-ir/types.js";
import type {
  ParsedSelectorQuery,
  SelectorAnalysisTarget,
  SelectorQueryResult,
  SelectorRenderModelIndex,
} from "../types.js";
import { buildSelectorQueryResult } from "../resultUtils.js";
import { attachMatchedReachability } from "../reachabilityResultUtils.js";
import {
  combinePresence,
  evaluateSingleClassPresence,
  type PresenceEvaluation,
} from "../selectorEvaluationUtils.js";
import { mergeInspectionEvaluations } from "../renderInspection.js";

type SiblingConstraint = Extract<ParsedSelectorQuery["constraint"], { kind: "sibling" }>;

type SequenceCertainty = "definite" | "possible";

type SiblingSequence = {
  nodes: RenderNode[];
  certainty: SequenceCertainty;
};

export function analyzeSiblingConstraint(input: {
  selectorQuery: ParsedSelectorQuery;
  constraint: SiblingConstraint;
  analysisTargets: SelectorAnalysisTarget[];
  renderModelIndex?: SelectorRenderModelIndex;
  includeTraces?: boolean;
}): SelectorQueryResult {
  const includeTraces = input.includeTraces ?? true;
  let sawUnsupportedDynamicClass = false;
  let sawPossibleMatch = false;
  const matchedTargets: SelectorAnalysisTarget[] = [];

  for (const analysisTarget of input.analysisTargets) {
    const evaluation =
      evaluateSiblingFromRenderModel({
        analysisTarget,
        constraint: input.constraint,
        renderModelIndex: input.renderModelIndex,
      }) ??
      inspectNodeForSiblingConstraint({
        node: analysisTarget.renderSubtree.root,
        constraint: input.constraint,
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
            `found a rendered ${describeRelation(input.constraint.relation)} sibling with class "${input.constraint.rightClassName}" after a sibling with class "${input.constraint.leftClassName}"`,
          ],
          certainty: "definite",
          dimensions: { structure: "definite" },
          traces: includeTraces
            ? [
                {
                  traceId: `selector-match:sibling:${input.constraint.relation}:definite`,
                  category: "selector-match",
                  summary: `found a rendered ${describeRelation(input.constraint.relation)} sibling with class "${input.constraint.rightClassName}" after a sibling with class "${input.constraint.leftClassName}"`,
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
          `found a plausible ${describeRelation(input.constraint.relation)} sibling match for "${input.constraint.leftClassName}${input.constraint.relation === "adjacent" ? " + " : " ~ "}${input.constraint.rightClassName}" on at least one bounded path`,
        ],
        certainty: "possible",
        dimensions: { structure: "possible" },
        traces: includeTraces
          ? [
              {
                traceId: `selector-match:sibling:${input.constraint.relation}:possible`,
                category: "selector-match",
                summary: `found a plausible ${describeRelation(input.constraint.relation)} sibling match for "${input.constraint.leftClassName}${input.constraint.relation === "adjacent" ? " + " : " ~ "}${input.constraint.rightClassName}" on at least one bounded path`,
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
        `encountered unsupported dynamic class construction while checking ${describeRelation(input.constraint.relation)} sibling structure`,
      ],
      certainty: "unknown",
      dimensions: { structure: "unsupported" },
      traces: includeTraces
        ? [
            {
              traceId: `selector-match:sibling:${input.constraint.relation}:unsupported`,
              category: "selector-match",
              summary: `encountered unsupported dynamic class construction while checking ${describeRelation(input.constraint.relation)} sibling structure`,
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
      `no bounded rendered path satisfied ${describeRelation(input.constraint.relation)} sibling "${input.constraint.leftClassName}" with sibling "${input.constraint.rightClassName}"`,
    ],
    certainty: "definite",
    dimensions: { structure: "not-found-under-bounded-analysis" },
    traces: includeTraces
      ? [
          {
            traceId: `selector-match:sibling:${input.constraint.relation}:no-match`,
            category: "selector-match",
            summary: `no bounded rendered path satisfied ${describeRelation(input.constraint.relation)} sibling "${input.constraint.leftClassName}" with sibling "${input.constraint.rightClassName}"`,
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

function evaluateSiblingFromRenderModel(input: {
  analysisTarget: SelectorAnalysisTarget;
  constraint: SiblingConstraint;
  renderModelIndex?: SelectorRenderModelIndex;
}): "match" | "possible-match" | "unsupported" | "no-match" | undefined {
  if (!input.renderModelIndex) {
    return undefined;
  }

  const scopedElements = getScopedElements(input.analysisTarget, input.renderModelIndex);
  const byId = new Map(scopedElements.map((element) => [element.id, element]));
  let sawPossible = false;
  let sawUnsupported = false;

  for (const left of scopedElements) {
    const siblingIds =
      input.renderModelIndex.renderModel.indexes.siblingElementIdsByElementId.get(left.id) ?? [];
    for (const siblingId of siblingIds) {
      const right = byId.get(siblingId);
      if (!right) {
        continue;
      }

      if (
        input.constraint.relation === "adjacent" &&
        !isAdjacent(input.renderModelIndex, left.id, right.id)
      ) {
        continue;
      }

      const leftPresence = evaluateElementPresence(
        input.renderModelIndex,
        left.id,
        input.constraint.leftClassName,
      );
      if (leftPresence === "no-match") {
        continue;
      }
      const rightPresence = evaluateElementPresence(
        input.renderModelIndex,
        right.id,
        input.constraint.rightClassName,
      );
      const combined =
        rightPresence === "no-match" ? "no-match" : combinePresence(leftPresence, rightPresence);
      if (combined === "match") {
        return "match";
      }
      if (combined === "possible-match") {
        sawPossible = true;
      }
      if (combined === "unsupported" || rightPresence === "unsupported") {
        sawUnsupported = true;
      }
    }
  }

  if (sawPossible) {
    return "possible-match";
  }
  if (sawUnsupported) {
    return "unsupported";
  }
  return undefined;
}

function isAdjacent(
  renderModelIndex: SelectorRenderModelIndex,
  leftElementId: string,
  rightElementId: string,
): boolean {
  const leftIndex = readChildIndex(renderModelIndex, leftElementId);
  const rightIndex = readChildIndex(renderModelIndex, rightElementId);
  if (leftIndex === undefined || rightIndex === undefined) {
    return false;
  }
  return Math.abs(leftIndex - rightIndex) === 1;
}

function readChildIndex(
  renderModelIndex: SelectorRenderModelIndex,
  elementId: string,
): number | undefined {
  const element = renderModelIndex.renderModel.indexes.elementById.get(elementId);
  if (!element) {
    return undefined;
  }
  const path = renderModelIndex.renderModel.indexes.renderPathById.get(element.renderPathId);
  if (!path) {
    return undefined;
  }

  for (let i = path.segments.length - 1; i >= 0; i -= 1) {
    const segment = path.segments[i];
    if (segment.kind === "child-index") {
      return segment.index;
    }
    if (segment.kind === "element") {
      continue;
    }
  }
  return undefined;
}

function getScopedElements(
  target: SelectorAnalysisTarget,
  renderModelIndex: SelectorRenderModelIndex,
): import("../../render-structure/types.js").RenderedElement[] {
  const rootAnchor = target.renderSubtree.root.sourceAnchor;
  const elements = [...renderModelIndex.renderModel.indexes.elementById.values()];
  return elements.filter((element) => {
    return containsAnchor(rootAnchor, element.sourceLocation);
  });
}

function evaluateElementPresence(
  renderModelIndex: SelectorRenderModelIndex,
  elementId: string,
  className: string,
): PresenceEvaluation {
  const emissionSiteIds =
    renderModelIndex.renderModel.indexes.emissionSiteIdsByElementId.get(elementId) ?? [];
  if (emissionSiteIds.length === 0) {
    return "no-match";
  }
  let sawPossible = false;
  let sawUnsupported = false;
  for (const siteId of emissionSiteIds) {
    const site = renderModelIndex.renderModel.indexes.emissionSiteById.get(siteId);
    if (!site) {
      continue;
    }
    if (
      site.emissionVariants.some(
        (variant) =>
          variant.tokens.includes(className) &&
          variant.completeness === "complete" &&
          !variant.unknownDynamic,
      )
    ) {
      return "definite";
    }
    if (site.emissionVariants.some((variant) => variant.tokens.includes(className))) {
      sawPossible = true;
    } else if (site.tokens.some((token) => token.token === className)) {
      sawPossible = true;
    } else if (site.unsupported.length > 0 || site.confidence === "low") {
      sawUnsupported = true;
    }
  }
  if (sawPossible) {
    return "possible";
  }
  if (sawUnsupported) {
    return "unsupported";
  }
  return "no-match";
}

function containsAnchor(
  containing: import("../../../types/core.js").SourceAnchor,
  contained: import("../../../types/core.js").SourceAnchor,
): boolean {
  const leftPath = containing.filePath.replace(/\\/g, "/");
  const rightPath = contained.filePath.replace(/\\/g, "/");
  if (leftPath !== rightPath) {
    return false;
  }
  const leftStart = containing.startLine * 1_000_000 + containing.startColumn;
  const leftEnd =
    (containing.endLine ?? containing.startLine) * 1_000_000 +
    (containing.endColumn ?? containing.startColumn);
  const rightStart = contained.startLine * 1_000_000 + contained.startColumn;
  const rightEnd =
    (contained.endLine ?? contained.startLine) * 1_000_000 +
    (contained.endColumn ?? contained.startColumn);
  return leftStart <= rightStart && leftEnd >= rightEnd;
}

function inspectNodeForSiblingConstraint(input: {
  node: RenderNode;
  constraint: SiblingConstraint;
}): "match" | "possible-match" | "unsupported" | "no-match" {
  const { node, constraint } = input;

  if (node.kind === "conditional") {
    return mergeInspectionEvaluations([
      inspectNodeForSiblingConstraint({
        node: node.whenTrue,
        constraint,
      }),
      inspectNodeForSiblingConstraint({
        node: node.whenFalse,
        constraint,
      }),
    ]);
  }

  if (node.kind === "fragment") {
    return inspectSiblingContainer(node.children, constraint);
  }

  if (node.kind === "repeated-region") {
    const evaluation = inspectNodeForSiblingConstraint({
      node: node.template,
      constraint,
    });
    return evaluation === "match" ? "possible-match" : evaluation;
  }

  if (node.kind !== "element") {
    return "no-match";
  }

  const localEvaluation = inspectSiblingContainer(node.children, constraint);
  if (localEvaluation !== "no-match") {
    return localEvaluation;
  }

  return mergeInspectionEvaluations(
    node.children.map((child) =>
      inspectNodeForSiblingConstraint({
        node: child,
        constraint,
      }),
    ),
  );
}

function inspectSiblingContainer(
  children: RenderNode[],
  constraint: SiblingConstraint,
): "match" | "possible-match" | "unsupported" | "no-match" {
  const sequences = expandSiblingSequences(children);
  let sawPossible = false;
  let sawUnsupported = false;

  for (const sequence of sequences) {
    const evaluation = evaluateSiblingSequence(sequence, constraint);
    if (evaluation === "match") {
      return sequence.certainty === "definite" ? "match" : "possible-match";
    }

    if (evaluation === "possible-match") {
      sawPossible = true;
    }

    if (evaluation === "unsupported") {
      sawUnsupported = true;
    }
  }

  if (sawPossible) {
    return "possible-match";
  }

  if (sawUnsupported) {
    return "unsupported";
  }

  return "no-match";
}

function expandSiblingSequences(children: RenderNode[]): SiblingSequence[] {
  let sequences: SiblingSequence[] = [{ nodes: [], certainty: "definite" }];

  for (const child of children) {
    const childSequences = expandNodeIntoSiblingSequences(child);
    const nextSequences: SiblingSequence[] = [];

    for (const sequence of sequences) {
      for (const childSequence of childSequences) {
        nextSequences.push({
          nodes: [...sequence.nodes, ...childSequence.nodes],
          certainty:
            sequence.certainty === "possible" || childSequence.certainty === "possible"
              ? "possible"
              : "definite",
        });
      }
    }

    sequences = nextSequences;
  }

  return sequences;
}

function expandNodeIntoSiblingSequences(node: RenderNode): SiblingSequence[] {
  if (node.kind === "fragment") {
    return expandSiblingSequences(node.children);
  }

  if (node.kind === "conditional") {
    return [
      ...expandNodeIntoSiblingSequences(node.whenTrue).map((sequence) => ({
        ...sequence,
        certainty: "possible" as const,
      })),
      ...expandNodeIntoSiblingSequences(node.whenFalse).map((sequence) => ({
        ...sequence,
        certainty: "possible" as const,
      })),
    ];
  }

  if (node.kind === "repeated-region") {
    return [
      {
        nodes: [],
        certainty: "possible",
      },
      ...expandNodeIntoSiblingSequences(node.template).map((sequence) => ({
        ...sequence,
        certainty: "possible" as const,
      })),
    ];
  }

  return [
    {
      nodes: [node],
      certainty: "definite",
    },
  ];
}

function evaluateSiblingSequence(
  sequence: SiblingSequence,
  constraint: SiblingConstraint,
): "match" | "possible-match" | "unsupported" | "no-match" {
  const candidatePairs =
    constraint.relation === "adjacent"
      ? sequence.nodes.flatMap((node, index) =>
          index < sequence.nodes.length - 1 ? [[node, sequence.nodes[index + 1]] as const] : [],
        )
      : sequence.nodes.flatMap((leftNode, leftIndex) =>
          sequence.nodes.slice(leftIndex + 1).map((rightNode) => [leftNode, rightNode] as const),
        );

  let sawPossible = false;
  let sawUnsupported = false;

  for (const [leftNode, rightNode] of candidatePairs) {
    const evaluation = evaluateSiblingPair(
      leftNode,
      rightNode,
      constraint.leftClassName,
      constraint.rightClassName,
    );

    if (evaluation === "match") {
      return sequence.certainty === "definite" ? "match" : "possible-match";
    }

    if (evaluation === "possible-match") {
      sawPossible = true;
    }

    if (evaluation === "unsupported") {
      sawUnsupported = true;
    }
  }

  if (sawPossible) {
    return "possible-match";
  }

  if (sawUnsupported) {
    return "unsupported";
  }

  return "no-match";
}

function evaluateSiblingPair(
  leftNode: RenderNode,
  rightNode: RenderNode,
  leftClassName: string,
  rightClassName: string,
): "match" | "possible-match" | "unsupported" | "no-match" {
  if (leftNode.kind !== "element" || rightNode.kind !== "element") {
    return "no-match";
  }

  const leftPresence = evaluateSingleClassPresence(leftNode.className, leftClassName);
  if (leftPresence === "no-match") {
    return "no-match";
  }

  return combinePresence(
    leftPresence,
    evaluateSingleClassPresence(rightNode.className, rightClassName),
  );
}

function describeRelation(relation: SiblingConstraint["relation"]): string {
  return relation === "adjacent" ? "adjacent" : "general";
}
