# End-To-End Traceability

## Purpose

This note defines the intended direction for explanation, uncertainty, and confidence handling across the static-analysis-engine pipeline.

It exists because the engine already preserves useful uncertainty internally, but today that information is exposed unevenly:

- many stages preserve domain-specific certainty
- selector analysis flattens that into a final `confidence`
- explanation mostly lives in freeform `reasons`

That is enough for an early bounded slice, but it is not the intended steady state.

## Design Goals

The engine should move toward three explicit design rules.

### 1. Preserve decisions, not just final confidence

Stages should preserve structured decision payloads that describe:

- the current certainty of the conclusion
- whether the conclusion is resolved, unsupported, or budget-limited
- the important uncertainty dimensions that contributed
- technical reasons and traces

The point is to keep enough machine-readable information that later stages do not need to reverse-engineer confidence from prose.

### 2. Keep user-facing confidence derived late

`high` / `medium` / `low` remains useful for findings and selector results, but it should be treated as a derived presentation value.

It should not be the main information passed between stages.

Why:

- multiple uncertainty dimensions already exist
- those dimensions will expand over time
- a single confidence bucket is too lossy to act as the pipeline source of truth

So the intended model is:

- stages preserve structured decisions
- selector analysis derives selector-result confidence from those decisions
- rule execution derives finding confidence from those decisions

### 3. Add minimal structured traces now

The engine does not need a fully polished explanation UI yet.

It does need a small shared trace type so explanations stop living only in string arrays.

The first trace schema should stay technical and compact.

## Proposed Minimal Shared Types

An initial shared shape should be small enough to adopt immediately:

```ts
type AnalysisTrace = {
  traceId: string;
  category:
    | "symbol-resolution"
    | "value-evaluation"
    | "render-expansion"
    | "selector-match"
    | "reachability"
    | "rule-evaluation";
  summary: string;
  anchor?: SourceAnchor;
  children: AnalysisTrace[];
  metadata?: Record<string, unknown>;
};

type AnalysisDecision = {
  status: "resolved" | "unsupported" | "budget-exceeded";
  certainty: "definite" | "possible" | "unknown";
  dimensions: Record<string, AnalysisDimensionState>;
  reasons: string[];
  traces: AnalysisTrace[];
};
```

This is intentionally not a giant trace graph or a final user-facing explanation contract.

It is only the minimum shared shape that lets us preserve explanation and uncertainty in a stable way.

## Decision Dimensions

The engine is already trending toward several independent uncertainty dimensions.

Examples:

- structural selector certainty
- stylesheet reachability certainty
- bounded-support status
- budget-driven uncertainty

Those dimensions should remain explicit inside `AnalysisDecision.dimensions`.

That does not require every stage to populate every dimension immediately.

It does require new work to stop collapsing all uncertainty into one confidence label too early.

## Intended First Implementation Slice

The first practical adoption should be narrow.

### Selector analysis

Selector results should carry:

- the existing outcome and status
- a shared `decision`
- a derived `confidence`
- the existing `reasons`

The first selector traces should cover:

- direct selector outcome classification
- reachability-based narrowing or downgrading

### Rule execution

Rule results should preserve upstream selector decisions when they are derived from selector analysis.

Confidence on rule results should be derived from the preserved decision rather than simply treated as a magical precomputed value.

### Reachability

Reachability does not need to adopt the full shared `AnalysisDecision` contract immediately.

It already preserves structured derivations and explicit availability states.

For now, selector analysis can bridge reachability derivations into shared trace payloads.

## Non-Goals

This note does not require:

- a final human-readable explanation UI
- a global trace store
- a dedicated pipeline stage that rewrites every model into trace trees
- immediate conversion of every subsystem to the shared decision contract

The first success condition is much smaller:

- shared trace and decision types exist
- selector analysis uses them
- rule execution preserves them
- confidence becomes a derived view rather than the primary pipeline payload

## Recommendation

This is a good approach.

It gives the engine a clean path toward richer explanation and uncertainty handling without forcing a massive rewrite right now.

The near-term rule of thumb should be:

- preserve structured uncertainty
- derive confidence late
- add small technical traces where conclusions are made

That keeps the system honest and gives future work somewhere stable to attach.
