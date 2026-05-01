import type { SelectorBranchNode } from "../fact-graph/index.js";
import type { RenderStructureResult } from "../render-structure/index.js";
import { selectorBranchMatchId } from "./ids.js";
import {
  buildElementMatchesForClassNames,
  getCandidateElementIds,
  type SelectorRenderMatchIndexes,
} from "./subjectMatches.js";
import type {
  SelectorBranchMatch,
  SelectorBranchRequirement,
  SelectorElementMatch,
} from "./types.js";
import { uniqueSorted } from "./utils.js";

export type StructuralConstraint = {
  combinator: "descendant" | "child" | "adjacent-sibling" | "general-sibling";
  leftClassName: string;
  rightClassName: string;
};

export type StructuralRelationIndexes = {
  childIndexByElementId: Map<string, number>;
  adjacentLeftSiblingIdByElementId: Map<string, string>;
  precedingSiblingIdsByElementId: Map<string, string[]>;
};

export function projectStructuralConstraintFromRequirement(
  requirement: SelectorBranchRequirement,
): StructuralConstraint | undefined {
  if (requirement.kind === "ancestor-descendant") {
    return {
      combinator: "descendant",
      leftClassName: requirement.ancestorClassName,
      rightClassName: requirement.subjectClassName,
    };
  }

  if (requirement.kind === "parent-child") {
    return {
      combinator: "child",
      leftClassName: requirement.parentClassName,
      rightClassName: requirement.childClassName,
    };
  }

  if (requirement.kind !== "sibling") {
    return undefined;
  }

  return {
    combinator: requirement.relation === "adjacent" ? "adjacent-sibling" : "general-sibling",
    leftClassName: requirement.leftClassName,
    rightClassName: requirement.rightClassName,
  };
}

export function buildStructuralMatches(input: {
  branch: SelectorBranchNode;
  constraint: StructuralConstraint;
  renderStructure: RenderStructureResult;
  renderIndexes: SelectorRenderMatchIndexes;
  structuralRelationIndexes?: StructuralRelationIndexes;
}): { elementMatches: SelectorElementMatch[]; branchMatches: SelectorBranchMatch[] } {
  const structuralRelationIndexes =
    input.structuralRelationIndexes ?? buildStructuralRelationIndexes(input.renderStructure);
  const requiredClassNames = uniqueSorted([
    input.constraint.leftClassName,
    input.constraint.rightClassName,
  ]);
  const leftMatches = buildElementMatchesForClassNames({
    branch: input.branch,
    classNames: [input.constraint.leftClassName],
    elementIds: getCandidateElementIds({
      classNames: [input.constraint.leftClassName],
      elementIdsByClassName: input.renderIndexes.elementIdsByClassName,
      renderIndexes: input.renderIndexes,
    }),
    renderIndexes: input.renderIndexes,
  });
  const rightMatches = buildElementMatchesForClassNames({
    branch: input.branch,
    classNames: [input.constraint.rightClassName],
    elementIds: getCandidateElementIds({
      classNames: [input.constraint.rightClassName],
      elementIdsByClassName: input.renderIndexes.elementIdsByClassName,
      renderIndexes: input.renderIndexes,
    }),
    renderIndexes: input.renderIndexes,
  });
  const leftMatchByElementId = new Map(leftMatches.map((match) => [match.elementId, match]));
  const branchMatches: SelectorBranchMatch[] = [];

  for (const rightMatch of rightMatches) {
    const rightElement = input.renderStructure.renderModel.indexes.elementById.get(
      rightMatch.elementId,
    );
    if (!rightElement) {
      continue;
    }
    for (const leftElementId of getRelatedLeftElementIds({
      renderStructure: input.renderStructure,
      rightElementId: rightMatch.elementId,
      combinator: input.constraint.combinator,
      structuralRelationIndexes,
    })) {
      const leftMatch = leftMatchByElementId.get(leftElementId);
      if (!leftMatch) {
        continue;
      }

      const leftElement = input.renderStructure.renderModel.indexes.elementById.get(leftElementId);
      if (!leftElement) {
        continue;
      }

      const certainty = combineCertainty(leftMatch.certainty, rightMatch.certainty);
      const leftFirstElementMatchId = leftMatch.id < rightMatch.id ? leftMatch.id : rightMatch.id;
      const rightSecondElementMatchId = leftMatch.id < rightMatch.id ? rightMatch.id : leftMatch.id;
      branchMatches.push({
        id: selectorBranchMatchId({
          selectorBranchNodeId: input.branch.id,
          elementId: `${leftMatch.elementId}:${rightMatch.elementId}`,
        }),
        selectorBranchNodeId: input.branch.id,
        subjectElementId: rightMatch.elementId,
        elementMatchIds: [leftFirstElementMatchId, rightSecondElementMatchId],
        supportingEmissionSiteIds: mergeUniqueSortedStrings(
          leftMatch.supportingEmissionSiteIds,
          rightMatch.supportingEmissionSiteIds,
        ),
        requiredClassNames,
        matchedClassNames: mergeUniqueSortedStrings(
          leftMatch.matchedClassNames,
          rightMatch.matchedClassNames,
        ),
        renderPathIds:
          leftElement.renderPathId === rightElement.renderPathId
            ? [leftElement.renderPathId]
            : leftElement.renderPathId < rightElement.renderPathId
              ? [leftElement.renderPathId, rightElement.renderPathId]
              : [rightElement.renderPathId, leftElement.renderPathId],
        placementConditionIds: mergeUniqueSortedStrings(
          leftElement.placementConditionIds,
          rightElement.placementConditionIds,
        ),
        certainty,
        confidence: certainty === "definite" ? "high" : "medium",
        traces: [],
      });
    }
  }

  return {
    elementMatches: deduplicateElementMatches([...leftMatches, ...rightMatches]),
    branchMatches: branchMatches.sort((left, right) => compareStrings(left.id, right.id)),
  };
}

function getRelatedLeftElementIds(input: {
  renderStructure: RenderStructureResult;
  rightElementId: string;
  combinator: StructuralConstraint["combinator"];
  structuralRelationIndexes: StructuralRelationIndexes;
}): string[] {
  if (input.combinator === "descendant") {
    return (
      input.renderStructure.renderModel.indexes.ancestorElementIdsByElementId.get(
        input.rightElementId,
      ) ?? []
    );
  }

  if (input.combinator === "child") {
    const element = input.renderStructure.renderModel.indexes.elementById.get(input.rightElementId);
    return element?.parentElementId ? [element.parentElementId] : [];
  }

  if (input.combinator === "adjacent-sibling") {
    const adjacentLeftSiblingId =
      input.structuralRelationIndexes.adjacentLeftSiblingIdByElementId.get(input.rightElementId);
    return adjacentLeftSiblingId ? [adjacentLeftSiblingId] : [];
  }

  return (
    input.structuralRelationIndexes.precedingSiblingIdsByElementId.get(input.rightElementId) ?? []
  );
}

function buildChildIndexByElementId(renderStructure: RenderStructureResult): Map<string, number> {
  const childIndexByElementId = new Map<string, number>();
  for (const element of renderStructure.renderModel.elements) {
    const path = renderStructure.renderModel.indexes.renderPathById.get(element.renderPathId);
    if (!path) {
      continue;
    }
    for (let i = path.segments.length - 1; i >= 0; i -= 1) {
      const segment = path.segments[i];
      if (segment.kind === "child-index") {
        childIndexByElementId.set(element.id, segment.index);
        break;
      }
      if (segment.kind === "element") {
        continue;
      }
    }
  }
  return childIndexByElementId;
}

export function buildStructuralRelationIndexes(
  renderStructure: RenderStructureResult,
): StructuralRelationIndexes {
  const childIndexByElementId = buildChildIndexByElementId(renderStructure);
  const adjacentLeftSiblingIdByElementId = new Map<string, string>();
  const precedingSiblingIdsByElementId = new Map<string, string[]>();

  for (const [elementId, siblingIds] of renderStructure.renderModel.indexes
    .siblingElementIdsByElementId) {
    const elementChildIndex = childIndexByElementId.get(elementId);
    if (elementChildIndex === undefined || siblingIds.length === 0) {
      continue;
    }
    const precedingSiblings: Array<{ siblingId: string; childIndex: number }> = [];
    for (const siblingId of siblingIds) {
      const siblingChildIndex = childIndexByElementId.get(siblingId);
      if (siblingChildIndex === undefined || siblingChildIndex >= elementChildIndex) {
        continue;
      }
      precedingSiblings.push({ siblingId, childIndex: siblingChildIndex });
    }
    if (precedingSiblings.length === 0) {
      continue;
    }
    precedingSiblings.sort((left, right) => left.childIndex - right.childIndex);
    precedingSiblingIdsByElementId.set(
      elementId,
      precedingSiblings.map((entry) => entry.siblingId),
    );
    const adjacent = precedingSiblings[precedingSiblings.length - 1];
    if (adjacent.childIndex === elementChildIndex - 1) {
      adjacentLeftSiblingIdByElementId.set(elementId, adjacent.siblingId);
    }
  }

  return {
    childIndexByElementId,
    adjacentLeftSiblingIdByElementId,
    precedingSiblingIdsByElementId,
  };
}

function combineCertainty(
  left: SelectorElementMatch["certainty"],
  right: SelectorElementMatch["certainty"],
): SelectorBranchMatch["certainty"] {
  if (left === "unknown-context" || right === "unknown-context") {
    return "unknown-context";
  }
  if (left === "definite" && right === "definite") {
    return "definite";
  }
  return "possible";
}

function deduplicateElementMatches(matches: SelectorElementMatch[]): SelectorElementMatch[] {
  const byId = new Map<string, SelectorElementMatch>();
  for (const match of matches) {
    byId.set(match.id, match);
  }
  return [...byId.values()].sort((left, right) => compareStrings(left.id, right.id));
}

function mergeUniqueSortedStrings(left: string[], right: string[]): string[] {
  const merged: string[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftValue = left[leftIndex];
    const rightValue = right[rightIndex];
    const comparison = compareStrings(leftValue, rightValue);
    if (comparison === 0) {
      merged.push(leftValue);
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    if (comparison < 0) {
      merged.push(leftValue);
      leftIndex += 1;
      continue;
    }
    merged.push(rightValue);
    rightIndex += 1;
  }
  while (leftIndex < left.length) {
    merged.push(left[leftIndex]);
    leftIndex += 1;
  }
  while (rightIndex < right.length) {
    merged.push(right[rightIndex]);
    rightIndex += 1;
  }
  return merged;
}

function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}
