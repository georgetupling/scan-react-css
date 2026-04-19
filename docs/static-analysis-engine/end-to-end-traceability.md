# End-To-End Traceability

## Purpose

This document defines the target traceability model for the `static-analysis-engine`.

The goal is not to trace everything indiscriminately. The goal is to preserve the decisions that help explain user-visible findings and conclusions.

## Core Rule

The target rule is:

- traces are required only for user-visible findings and explanations

That means the engine should preserve structured traces where they help answer questions like:

- why was this selector considered definite, possible, unsupported, or not satisfied?
- why is this stylesheet considered reachable here?
- why did render reasoning stop at this point?
- why did a finding receive this confidence?

It does not mean every small internal step needs to become a first-class trace artifact.

## Design Principles

### 1. Producer-owned traces

The stage that makes a decision should emit the trace that explains it.

Later stages should preserve and reference those traces, not recreate them from freeform reasons.

### 2. Decision-first, confidence-late

Confidence remains useful, but it should be derived late from structured decisions and traces.

The main pipeline payload should be:

- decision status
- certainty
- reasons
- traces

not just:

- `high`
- `medium`
- `low`

### 3. Structured enough for later presentation

Traces should be technical and structured enough that a later presentation layer can turn them into simpler human-readable explanations.

The target is not polished prose in every stage. The target is preserving enough meaning that a presentation layer can simplify without inventing.

### 4. Avoid noisy trace inflation

If a trace does not help explain a user-visible conclusion, it should usually remain:

- stage-local diagnostic data
- debug-only output
- or no trace at all

## Trace Categories

The exact enum can evolve, but the engine should have stable categories that correspond to decision ownership.

Recommended categories:

- `symbol-resolution`
- `abstract-values`
- `render-graph`
- `render-ir`
- `css-analysis`
- `reachability`
- `selector-analysis`
- `rule-execution`

The important point is that categories should point back to the stage that made the conclusion.

## Shared Trace Shape

The shared trace type should stay small and stable.

Recommended minimum shape:

```ts
type AnalysisTrace = {
  traceId: string;
  category: string;
  summary: string;
  anchor?: SourceAnchor;
  children: AnalysisTrace[];
  metadata?: Record<string, unknown>;
};
```

Recommended shared decision shape:

```ts
type AnalysisDecision = {
  status: "resolved" | "unsupported" | "budget-exceeded";
  certainty: "definite" | "possible" | "unknown";
  reasons: string[];
  traces: AnalysisTrace[];
  metadata?: Record<string, unknown>;
};
```

This is intentionally modest. The goal is a stable explanation-carrying contract, not an over-designed trace graph.

## Required Trace Responsibilities By Stage

### `parse`

Required traces:

- only for parse failures or unsupported syntax that materially affects later analysis

Usually not required:

- routine successful parsing

### `module-graph`

Required traces:

- unresolved or unresolvable import/export structure when it affects later user-visible uncertainty

Usually not required:

- ordinary import/export graph construction

### `symbol-resolution`

Required traces:

- imported binding resolved through a non-trivial chain
- re-export chain followed
- unresolved imported binding
- namespace resolution cutoff or unsupported case
- budget-limited symbol resolution stop

Why:

- these traces explain where later values or components came from
- they also explain why the engine stopped following a path

### `abstract-values`

Required traces:

- exact value successfully derived when it directly supports a later conclusion
- value downgraded from exact to possible
- unknown introduced because of unsupported expression shape
- evaluation stopped because of budget or recursion limits

Why:

- these traces explain why class or prop reasoning is definite, possible, or unknown

### `render-graph`

Required traces:

- component edge resolved in a non-trivial way
- component edge left unresolved
- render-path certainty downgraded

Why:

- these traces explain structural component relationships that feed render and reachability reasoning

### `render-ir`

Required traces:

- component expansion succeeded through an important boundary
- subtree inserted through `children` or JSX-valued prop flow
- expansion stopped because of unsupported construct
- cycle detected
- budget or depth limit reached
- unknown render node introduced

Why:

- this is a major explanation-producing stage for "could this actually render?"

### `css-analysis`

Required traces:

- only when unsupported CSS parsing or selector extraction materially affects a user-visible conclusion

Usually not required:

- routine CSS extraction and normalization

### `reachability`

Required traces:

- stylesheet directly available because of direct import
- availability propagated through component/render structure
- availability downgraded to possible
- unknown barrier introduced
- availability unavailable because no analyzed path establishes it

Why:

- these traces directly support human explanations for selector and finding results

### `selector-analysis`

Required traces:

- selector normalized successfully when that normalization matters to the conclusion
- selector unsupported
- selector definitely satisfied
- selector possibly satisfied
- selector not satisfied under bounded analysis
- selector blocked by unknown render or reachability context

Why:

- this stage makes some of the most directly user-visible semantic decisions

### `rule-execution`

Required traces:

- which upstream decision(s) caused the finding
- why severity/confidence were derived as they were
- why a rule chose not to emit a finding in an edge case, when useful for comparison or debugging

Why:

- findings are the product-facing output and need an explanation path back to engine reasoning

## What Should Stay Out Of The Main Trace Contract

These may still exist as internal diagnostics, but they should not automatically be part of the main explanation payload:

- per-node successful bookkeeping with no uncertainty
- low-level parser mechanics
- stable sorting or normalization steps that do not affect meaning
- cache hits and internal memoization details
- repetitive structural steps that add bulk but not understanding

## Trace Propagation Rule

Later stages should preserve upstream traces when they depend on upstream decisions.

For example:

- `selector-analysis` should preserve relevant reachability traces
- `rule-execution` should preserve relevant selector and reachability traces

But later stages should not flatten all upstream traces into one giant undifferentiated list. They should preserve ownership and structure where practical.

## Human-Readable Explanation Strategy

The target product should eventually be able to produce simplified human-readable explanations from structured trace data.

That presentation layer should:

- pick the highest-signal traces
- collapse repetitive technical detail
- preserve the stage that owned the reasoning
- keep enough provenance for debugging when needed

So the pipeline goal is:

- preserve good structured explanation inputs now
- simplify them later in presentation

not:

- write final polished prose in every stage right now

## Relationship To Findings

The key success condition is not "every stage has traces".

The key success condition is:

- every important user-visible finding or selector conclusion can point to the stage decisions that justify it

That is the traceability standard the architecture should optimize for.

## Temporary State Vs Target State

Today the implementation already has useful traces in some stages, especially reachability and selector-related work.

The target state is:

- trace responsibilities are documented stage by stage
- decision-heavy stages emit structured traces intentionally
- confidence is derived late
- rule execution preserves explanation lineage
- the eventual presentation layer can simplify structured traces into human-readable output

## Summary

The target traceability model is selective rather than exhaustive.

The engine should trace:

- meaningful decisions
- meaningful uncertainty
- meaningful stopping points

and it should do so in the stage that actually made the call.

That gives the project a path to strong human-readable explanations later without forcing the pipeline to preserve mountains of noisy internal detail now.
