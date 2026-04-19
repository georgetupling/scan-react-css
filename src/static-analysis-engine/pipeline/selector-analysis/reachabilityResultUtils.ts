import type { ParsedSelectorQuery, SelectorQueryResult } from "./types.js";
import type { SelectorAnalysisTarget } from "./types.js";

export function attachMatchedReachability(input: {
  selectorQuery: ParsedSelectorQuery;
  result: SelectorQueryResult;
  matchedTargets: SelectorAnalysisTarget[];
}): SelectorQueryResult {
  if (input.selectorQuery.source.kind !== "css-source") {
    return input.result;
  }

  const cssFilePath = input.selectorQuery.source.selectorAnchor?.filePath;
  const matchedContextsByKey = new Map<
    string,
    SelectorAnalysisTarget["reachabilityContexts"][number]
  >();
  for (const target of input.matchedTargets) {
    for (const contextRecord of target.reachabilityContexts) {
      matchedContextsByKey.set(serializeContextRecord(contextRecord), contextRecord);
    }
  }

  return {
    ...input.result,
    reachability: {
      kind: "css-source",
      cssFilePath,
      availability:
        input.result.outcome === "match"
          ? "definite"
          : input.matchedTargets.some((target) => target.reachabilityAvailability === "possible")
            ? "possible"
            : "definite",
      contexts: [...matchedContextsByKey.values()],
      matchedContexts: [...matchedContextsByKey.values()],
      reasons: [
        input.result.outcome === "match"
          ? "selector matched within stylesheet-reachable render contexts"
          : "selector only matched within possible stylesheet-reachable render contexts",
      ],
    },
  };
}

function serializeContextRecord(
  contextRecord: SelectorAnalysisTarget["reachabilityContexts"][number],
): string {
  return JSON.stringify(contextRecord);
}
