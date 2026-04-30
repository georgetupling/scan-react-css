import type { RenderNode } from "../../render-model/render-ir/types.js";
import type {
  ParsedSelectorQuery,
  SelectorAnalysisTarget,
  SelectorQueryResult,
  SelectorRenderModelIndex,
} from "../types.js";
import { buildSelectorQueryResult } from "../resultUtils.js";
import type { RenderNodeInspectionAdapter } from "../renderInspection.js";
import { inspectRenderNode } from "../renderInspection.js";
import { attachMatchedReachability } from "../reachabilityResultUtils.js";
import {
  combinePresence,
  evaluateSingleClassPresence,
  type PresenceEvaluation,
} from "../selectorEvaluationUtils.js";

type ParentChildConstraint = Extract<ParsedSelectorQuery["constraint"], { kind: "parent-child" }>;

type ParentChildState = {
  parentClassName: string;
  childClassName: string;
};

export function analyzeParentChildConstraint(input: {
  selectorQuery: ParsedSelectorQuery;
  constraint: ParentChildConstraint;
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
      evaluateParentChildFromRenderModel({
        analysisTarget,
        parentClassName: input.constraint.parentClassName,
        childClassName: input.constraint.childClassName,
        renderModelIndex: input.renderModelIndex,
      }) ??
      inspectRenderNode({
        node: analysisTarget.renderSubtree.root,
        state: {
          parentClassName: input.constraint.parentClassName,
          childClassName: input.constraint.childClassName,
        },
        adapter: parentChildConstraintAdapter,
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
            `found a rendered child with class "${input.constraint.childClassName}" directly under a parent with class "${input.constraint.parentClassName}"`,
          ],
          certainty: "definite",
          dimensions: { structure: "definite" },
          traces: includeTraces
            ? [
                {
                  traceId: "selector-match:parent-child:definite",
                  category: "selector-match",
                  summary: `found a rendered child with class "${input.constraint.childClassName}" directly under a parent with class "${input.constraint.parentClassName}"`,
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
          `found a plausible direct parent-child match for "${input.constraint.parentClassName} > ${input.constraint.childClassName}" on at least one bounded path`,
        ],
        certainty: "possible",
        dimensions: { structure: "possible" },
        traces: includeTraces
          ? [
              {
                traceId: "selector-match:parent-child:possible",
                category: "selector-match",
                summary: `found a plausible direct parent-child match for "${input.constraint.parentClassName} > ${input.constraint.childClassName}" on at least one bounded path`,
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
        "encountered unsupported dynamic class construction while checking direct parent-child structure",
      ],
      certainty: "unknown",
      dimensions: { structure: "unsupported" },
      traces: includeTraces
        ? [
            {
              traceId: "selector-match:parent-child:unsupported",
              category: "selector-match",
              summary:
                "encountered unsupported dynamic class construction while checking direct parent-child structure",
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
      `no bounded rendered path satisfied parent "${input.constraint.parentClassName}" with direct child "${input.constraint.childClassName}"`,
    ],
    certainty: "definite",
    dimensions: { structure: "not-found-under-bounded-analysis" },
    traces: includeTraces
      ? [
          {
            traceId: "selector-match:parent-child:no-match",
            category: "selector-match",
            summary: `no bounded rendered path satisfied parent "${input.constraint.parentClassName}" with direct child "${input.constraint.childClassName}"`,
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

function evaluateParentChildFromRenderModel(input: {
  analysisTarget: SelectorAnalysisTarget;
  parentClassName: string;
  childClassName: string;
  renderModelIndex?: SelectorRenderModelIndex;
}): "match" | "possible-match" | "unsupported" | "no-match" | undefined {
  if (!input.renderModelIndex) {
    return undefined;
  }

  const scopedElements = getScopedElements(input.analysisTarget, input.renderModelIndex);
  const scopedElementIds = new Set(scopedElements.map((element) => element.id));
  let sawPossible = false;
  let sawUnsupported = false;

  for (const childElement of scopedElements) {
    const parentId = childElement.parentElementId;
    if (!parentId || !scopedElementIds.has(parentId)) {
      continue;
    }
    const parentPresence = evaluateElementPresence(
      input.renderModelIndex,
      parentId,
      input.parentClassName,
    );
    if (parentPresence === "no-match") {
      continue;
    }
    const childPresence = evaluateElementPresence(
      input.renderModelIndex,
      childElement.id,
      input.childClassName,
    );
    const combined =
      childPresence === "no-match" ? "no-match" : combinePresence(parentPresence, childPresence);
    if (combined === "match") {
      return "match";
    }
    if (combined === "possible-match") {
      sawPossible = true;
    }
    if (combined === "unsupported" || childPresence === "unsupported") {
      sawUnsupported = true;
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

const parentChildConstraintAdapter: RenderNodeInspectionAdapter<ParentChildState> = {
  inspectElement({ node, state, helpers }) {
    const parentPresence = evaluateSingleClassPresence(node.className, state.parentClassName);
    if (parentPresence !== "no-match") {
      const directChildEvaluation = helpers.inspectDirectChildren(node.children, (child) =>
        inspectDirectChildForClassRequirement(child, state.childClassName, parentPresence),
      );

      if (directChildEvaluation !== "no-match") {
        return directChildEvaluation;
      }
    }

    const childEvaluation = helpers.inspectChildren(node.children, state);
    if (childEvaluation !== "no-match") {
      return childEvaluation;
    }

    if (parentPresence === "unsupported") {
      return "unsupported";
    }

    return "no-match";
  },
};

function inspectDirectChildForClassRequirement(
  node: RenderNode,
  childClassName: string,
  parentPresence: Exclude<PresenceEvaluation, "no-match">,
): "match" | "possible-match" | "unsupported" | "no-match" {
  if (node.kind === "conditional") {
    const whenTrue = inspectDirectChildForClassRequirement(
      node.whenTrue,
      childClassName,
      parentPresence,
    );
    const whenFalse = inspectDirectChildForClassRequirement(
      node.whenFalse,
      childClassName,
      parentPresence,
    );
    return whenTrue === "match" && whenFalse === "match"
      ? "match"
      : whenTrue === "match" || whenFalse === "match"
        ? "possible-match"
        : whenTrue === "possible-match" || whenFalse === "possible-match"
          ? "possible-match"
          : whenTrue === "unsupported" || whenFalse === "unsupported"
            ? "unsupported"
            : "no-match";
  }

  if (node.kind === "fragment") {
    const evaluations = node.children.map((child) =>
      inspectDirectChildForClassRequirement(child, childClassName, parentPresence),
    );
    if (evaluations.includes("match")) {
      return "match";
    }
    if (evaluations.includes("possible-match")) {
      return "possible-match";
    }
    if (evaluations.includes("unsupported")) {
      return "unsupported";
    }
    return "no-match";
  }

  if (node.kind === "repeated-region") {
    const evaluation = inspectDirectChildForClassRequirement(
      node.template,
      childClassName,
      parentPresence,
    );
    return evaluation === "match" ? "possible-match" : evaluation;
  }

  if (node.kind !== "element") {
    return "no-match";
  }

  return combinePresence(
    parentPresence,
    evaluateSingleClassPresence(node.className, childClassName),
  );
}
