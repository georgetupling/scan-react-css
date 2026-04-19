import type { RenderNode } from "../../render-ir/types.js";
import type { ParsedSelectorQuery, SelectorAnalysisTarget, SelectorQueryResult } from "../types.js";
import { mergeBranchEvaluations, mergeInspectionEvaluations } from "../renderInspection.js";
import { attachMatchedReachability } from "../reachabilityResultUtils.js";
import { evaluateClassRequirement } from "../selectorEvaluationUtils.js";

type SameNodeConstraint = Extract<
  ParsedSelectorQuery["constraint"],
  { kind: "same-node-class-conjunction" }
>;

export function analyzeSameNodeClassConjunction(input: {
  selectorQuery: ParsedSelectorQuery;
  constraint: SameNodeConstraint;
  analysisTargets: SelectorAnalysisTarget[];
}): SelectorQueryResult {
  let sawUnsupportedDynamicClass = false;
  let sawPossibleMatch = false;
  const matchedTargets: SelectorAnalysisTarget[] = [];

  for (const analysisTarget of input.analysisTargets) {
    const evaluation = inspectNodeForSameNodeConstraint(
      analysisTarget.renderSubtree.root,
      input.constraint.classNames,
    );
    if (evaluation === "match") {
      if (analysisTarget.reachabilityAvailability === "possible") {
        sawPossibleMatch = true;
        matchedTargets.push(analysisTarget);
        continue;
      }

      return attachMatchedReachability({
        selectorQuery: input.selectorQuery,
        matchedTargets: [analysisTarget],
        result: {
          selectorText: input.selectorQuery.selectorText,
          source: input.selectorQuery.source,
          constraint: input.constraint,
          outcome: "match",
          status: "resolved",
          confidence: "high",
          reasons: [
            `found a rendered element with all required classes: ${input.constraint.classNames.join(", ")}`,
          ],
        },
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
      result: {
        selectorText: input.selectorQuery.selectorText,
        source: input.selectorQuery.source,
        constraint: input.constraint,
        outcome: "possible-match",
        status: "resolved",
        confidence: "medium",
        reasons: [
          `at least one rendered element may emit all required classes together: ${input.constraint.classNames.join(", ")}`,
        ],
      },
    });
  }

  if (sawUnsupportedDynamicClass) {
    return {
      selectorText: input.selectorQuery.selectorText,
      source: input.selectorQuery.source,
      constraint: input.constraint,
      outcome: "possible-match",
      status: "unsupported",
      confidence: "low",
      reasons: [
        "encountered unsupported dynamic class construction while checking same-node class conjunction",
      ],
    };
  }

  return {
    selectorText: input.selectorQuery.selectorText,
    source: input.selectorQuery.source,
    constraint: input.constraint,
    outcome: "no-match-under-bounded-analysis",
    status: "resolved",
    confidence: "high",
    reasons: [
      `no rendered element emitted all required classes together: ${input.constraint.classNames.join(", ")}`,
    ],
  };
}

function inspectNodeForSameNodeConstraint(
  node: RenderNode,
  classNames: string[],
): "match" | "possible-match" | "unsupported" | "no-match" {
  if (node.kind === "element") {
    const evaluation = evaluateClassRequirement(node.className, classNames);
    if (evaluation !== "no-match") {
      return evaluation;
    }
  }

  if (node.kind === "conditional") {
    const whenTrue = inspectNodeForSameNodeConstraint(node.whenTrue, classNames);
    const whenFalse = inspectNodeForSameNodeConstraint(node.whenFalse, classNames);
    return mergeBranchEvaluations(whenTrue, whenFalse);
  }

  if (node.kind === "repeated-region") {
    const evaluation = inspectNodeForSameNodeConstraint(node.template, classNames);
    return evaluation === "match" ? "possible-match" : evaluation;
  }

  if (node.kind === "fragment") {
    return mergeInspectionEvaluations(
      node.children.map((child) => inspectNodeForSameNodeConstraint(child, classNames)),
    );
  }

  if (node.kind === "element") {
    return mergeInspectionEvaluations(
      node.children.map((child) => inspectNodeForSameNodeConstraint(child, classNames)),
    );
  }

  return "no-match";
}
