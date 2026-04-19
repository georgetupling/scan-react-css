import type { ParsedSelectorQuery, SelectorQueryResult } from "./types.js";
import type { SelectorAnalysisTarget } from "./types.js";
import type { AnalysisTrace } from "../../types/analysis.js";

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

  const availability =
    input.result.outcome === "match"
      ? "definite"
      : input.matchedTargets.some((target) => target.reachabilityAvailability === "possible")
        ? "possible"
        : "definite";
  const reachabilityTrace: AnalysisTrace = {
    traceId: `selector-reachability:${availability}`,
    category: "reachability",
    summary:
      input.result.outcome === "match"
        ? "selector matched within stylesheet-reachable render contexts"
        : "selector only matched within possible stylesheet-reachable render contexts",
    anchor:
      input.selectorQuery.source.kind === "css-source"
        ? input.selectorQuery.source.selectorAnchor
        : undefined,
    children: mergeTraces(
      [...matchedContextsByKey.values()].flatMap((context) => context.traces ?? []),
    ),
    metadata: {
      cssFilePath,
      matchedContextCount: matchedContextsByKey.size,
      availability,
    },
  };

  return {
    ...input.result,
    decision: {
      ...input.result.decision,
      dimensions: {
        ...input.result.decision.dimensions,
        reachability: availability,
      },
      traces: [...input.result.decision.traces, reachabilityTrace],
    },
    reachability: {
      kind: "css-source",
      cssFilePath,
      availability,
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

function mergeTraces(traces: AnalysisTrace[]): AnalysisTrace[] {
  const tracesByKey = new Map<string, AnalysisTrace>();
  for (const trace of traces) {
    tracesByKey.set(JSON.stringify(trace), trace);
  }

  return [...tracesByKey.values()];
}
