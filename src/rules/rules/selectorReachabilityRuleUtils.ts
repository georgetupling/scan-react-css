import {
  selectorBranchSourceKey,
  type SelectorBranchReachability,
} from "../../static-analysis-engine/index.js";
import type { RuleContext, UnresolvedFinding } from "../types.js";

export type ProjectSelectorBranch = RuleContext["analysis"]["entities"]["selectorBranches"][number];

export type ProjectSelectorQuery = RuleContext["analysis"]["entities"]["selectorQueries"][number];

export function getSelectorReachabilityBranches(
  context: RuleContext,
): SelectorBranchReachability[] {
  return context.analysis.evidence.selectorReachability?.selectorBranches ?? [];
}

export function getProjectSelectorBranchForReachability(
  context: RuleContext,
  branch: SelectorBranchReachability,
): ProjectSelectorBranch | undefined {
  const sourceKey = selectorBranchSourceKey({
    ruleKey: branch.ruleKey,
    branchIndex: branch.branchIndex,
    selectorText: branch.branchText,
    location: branch.location,
  });

  return context.analysis.entities.selectorBranches.find((candidate) => {
    const source = candidate.sourceQuery.sourceResult.source;
    if (source.kind !== "css-source") {
      return false;
    }

    return (
      selectorBranchSourceKey({
        ruleKey: source.ruleKey,
        branchIndex: source.branchIndex,
        selectorText: candidate.selectorText,
        location: source.selectorAnchor,
      }) === sourceKey
    );
  });
}

export function getProjectSelectorQueryForReachability(
  context: RuleContext,
  branch: SelectorBranchReachability,
): ProjectSelectorQuery | undefined {
  const projectBranch = getProjectSelectorBranchForReachability(context, branch);
  return projectBranch
    ? context.analysis.indexes.selectorQueriesById.get(projectBranch.selectorQueryId)
    : undefined;
}

export function buildReachabilitySelectorEvidence(input: {
  context: RuleContext;
  projectBranch?: ProjectSelectorBranch;
  projectQuery?: ProjectSelectorQuery;
  extraBranches?: ProjectSelectorBranch[];
}): UnresolvedFinding["evidence"] {
  const evidence: UnresolvedFinding["evidence"] = [];
  const stylesheetId = input.projectBranch?.stylesheetId ?? input.projectQuery?.stylesheetId;

  if (stylesheetId && input.context.analysis.indexes.stylesheetsById.has(stylesheetId)) {
    evidence.push({
      kind: "stylesheet",
      id: stylesheetId,
    });
  }

  for (const branch of input.extraBranches ?? []) {
    evidence.push({
      kind: "selector-branch",
      id: branch.id,
    });
  }

  return evidence;
}

export function isReachabilityMatched(branch: SelectorBranchReachability): boolean {
  return (
    branch.status === "definitely-matchable" ||
    branch.status === "possibly-matchable" ||
    branch.status === "only-matches-in-unknown-context"
  );
}
