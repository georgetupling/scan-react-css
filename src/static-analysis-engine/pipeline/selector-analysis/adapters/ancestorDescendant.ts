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

type AncestorDescendantConstraint = Extract<
  ParsedSelectorQuery["constraint"],
  { kind: "ancestor-descendant" }
>;

export function analyzeAncestorDescendantConstraint(input: {
  selectorQuery: ParsedSelectorQuery;
  constraint: AncestorDescendantConstraint;
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
      evaluateAncestorDescendantFromRenderModel({
        analysisTarget,
        ancestorClassName: input.constraint.ancestorClassName,
        subjectClassName: input.constraint.subjectClassName,
        renderModelIndex: input.renderModelIndex,
      }) ??
      inspectNodeForAncestorDescendantConstraint({
        node: analysisTarget.renderSubtree.root,
        ancestorClassName: input.constraint.ancestorClassName,
        subjectClassName: input.constraint.subjectClassName,
        ancestorStack: [],
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
            `found a rendered descendant with class "${input.constraint.subjectClassName}" under an ancestor with class "${input.constraint.ancestorClassName}"`,
          ],
          certainty: "definite",
          dimensions: { structure: "definite" },
          traces: includeTraces
            ? [
                {
                  traceId: "selector-match:ancestor-descendant:definite",
                  category: "selector-match",
                  summary: `found a rendered descendant with class "${input.constraint.subjectClassName}" under an ancestor with class "${input.constraint.ancestorClassName}"`,
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
          `found a plausible ancestor-descendant match for "${input.constraint.ancestorClassName} ${input.constraint.subjectClassName}" on at least one bounded path`,
        ],
        certainty: "possible",
        dimensions: { structure: "possible" },
        traces: includeTraces
          ? [
              {
                traceId: "selector-match:ancestor-descendant:possible",
                category: "selector-match",
                summary: `found a plausible ancestor-descendant match for "${input.constraint.ancestorClassName} ${input.constraint.subjectClassName}" on at least one bounded path`,
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
        "encountered unsupported dynamic class construction while checking ancestor-descendant structure",
      ],
      certainty: "unknown",
      dimensions: { structure: "unsupported" },
      traces: includeTraces
        ? [
            {
              traceId: "selector-match:ancestor-descendant:unsupported",
              category: "selector-match",
              summary:
                "encountered unsupported dynamic class construction while checking ancestor-descendant structure",
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
      `no bounded rendered path satisfied ancestor "${input.constraint.ancestorClassName}" with descendant "${input.constraint.subjectClassName}"`,
    ],
    certainty: "definite",
    dimensions: { structure: "not-found-under-bounded-analysis" },
    traces: includeTraces
      ? [
          {
            traceId: "selector-match:ancestor-descendant:no-match",
            category: "selector-match",
            summary: `no bounded rendered path satisfied ancestor "${input.constraint.ancestorClassName}" with descendant "${input.constraint.subjectClassName}"`,
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

function evaluateAncestorDescendantFromRenderModel(input: {
  analysisTarget: SelectorAnalysisTarget;
  ancestorClassName: string;
  subjectClassName: string;
  renderModelIndex?: SelectorRenderModelIndex;
}): "match" | "possible-match" | "unsupported" | "no-match" | undefined {
  if (!input.renderModelIndex) {
    return undefined;
  }

  const scopedElements = getScopedElements(input.analysisTarget, input.renderModelIndex);
  let sawPossible = false;
  let sawUnsupported = false;

  for (const subjectElement of scopedElements) {
    const subjectPresence = evaluateElementPresence(
      input.renderModelIndex,
      subjectElement.id,
      input.subjectClassName,
    );
    if (subjectPresence === "no-match") {
      continue;
    }

    const ancestorIds =
      input.renderModelIndex.renderModel.indexes.ancestorElementIdsByElementId.get(
        subjectElement.id,
      ) ?? [];
    for (const ancestorId of ancestorIds) {
      const ancestorPresence = evaluateElementPresence(
        input.renderModelIndex,
        ancestorId,
        input.ancestorClassName,
      );
      const combined =
        ancestorPresence === "no-match"
          ? "no-match"
          : combinePresence(ancestorPresence, subjectPresence);
      if (combined === "match") {
        return "match";
      }
      if (combined === "possible-match") {
        sawPossible = true;
      }
      if (combined === "unsupported" || subjectPresence === "unsupported") {
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

function inspectNodeForAncestorDescendantConstraint(input: {
  node: RenderNode;
  ancestorClassName: string;
  subjectClassName: string;
  ancestorStack: Array<Exclude<PresenceEvaluation, "no-match">>;
}): "match" | "possible-match" | "unsupported" | "no-match" {
  const { node, ancestorClassName, subjectClassName, ancestorStack } = input;

  if (node.kind === "conditional") {
    const whenTrue = inspectNodeForAncestorDescendantConstraint({
      ...input,
      node: node.whenTrue,
    });
    const whenFalse = inspectNodeForAncestorDescendantConstraint({
      ...input,
      node: node.whenFalse,
    });
    return mergeEvaluations([whenTrue, whenFalse], true);
  }

  if (node.kind === "fragment") {
    return mergeEvaluations(
      node.children.map((child) =>
        inspectNodeForAncestorDescendantConstraint({
          ...input,
          node: child,
        }),
      ),
    );
  }

  if (node.kind === "repeated-region") {
    const evaluation = inspectNodeForAncestorDescendantConstraint({
      ...input,
      node: node.template,
    });
    return evaluation === "match" ? "possible-match" : evaluation;
  }

  if (node.kind !== "element") {
    return "no-match";
  }

  const ancestorPresence = evaluateSingleClassPresence(node.className, ancestorClassName);
  const nextAncestorStack = [...ancestorStack];
  if (ancestorPresence !== "no-match") {
    nextAncestorStack.push(ancestorPresence);
  }

  const subjectPresence = evaluateSingleClassPresence(node.className, subjectClassName);
  const strongestAncestor = strongestAncestorPresence(ancestorStack);

  if (strongestAncestor && subjectPresence !== "no-match") {
    const combined = combinePresence(strongestAncestor, subjectPresence);
    if (combined !== "no-match") {
      return combined;
    }
  }

  const childEvaluation = mergeEvaluations(
    node.children.map((child) =>
      inspectNodeForAncestorDescendantConstraint({
        ...input,
        node: child,
        ancestorStack: nextAncestorStack,
      }),
    ),
  );

  if (childEvaluation !== "no-match") {
    return childEvaluation;
  }

  if (ancestorPresence === "unsupported" || subjectPresence === "unsupported") {
    return "unsupported";
  }

  return "no-match";
}

function strongestAncestorPresence(
  ancestorStack: Array<Exclude<PresenceEvaluation, "no-match">>,
): Exclude<PresenceEvaluation, "no-match"> | undefined {
  if (ancestorStack.includes("definite")) {
    return "definite";
  }

  if (ancestorStack.includes("possible")) {
    return "possible";
  }

  if (ancestorStack.includes("unsupported")) {
    return "unsupported";
  }

  return undefined;
}

function mergeEvaluations(
  evaluations: Array<"match" | "possible-match" | "unsupported" | "no-match">,
  treatAsBranches = false,
): "match" | "possible-match" | "unsupported" | "no-match" {
  if (evaluations.includes("match")) {
    if (treatAsBranches && evaluations.every((evaluation) => evaluation === "match")) {
      return "match";
    }

    return treatAsBranches ? "possible-match" : "match";
  }

  if (evaluations.includes("possible-match")) {
    return "possible-match";
  }

  if (evaluations.includes("unsupported")) {
    return "unsupported";
  }

  return "no-match";
}
