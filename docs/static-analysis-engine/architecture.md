# Static Analysis Engine Architecture

## Purpose

This document describes the proposed architecture for the new static-analysis-engine track.

It is the first implementation-oriented architecture note for the new engine.

It takes the high-level direction from:

- [requirements.md](./requirements.md)
- [directory-structure-and-boundaries.md](./directory-structure-and-boundaries.md)
- [core-irs-and-type-shapes.md](./core-irs-and-type-shapes.md)

and turns that into a concrete staged architecture.

## Scope Of This Architecture

This architecture is intentionally written around the first bounded target capability:

- ancestor-qualified selector satisfiability

In other words, the first version of the new engine is not trying to solve every future problem at once.

It is trying to answer a focused question:

- can a selector like `.ancestor .child` be satisfied by approximate rendered structure under bounded analysis?

That bounded target keeps the architecture concrete and prevents the design from expanding into a vague "future perfect engine."

## Architecture Goals

The architecture should satisfy the following goals.

### 1. Be meaningfully different from the current scanner

The new engine should not merely repackage file-level reachability.

It should add real program and render reasoning.

### 2. Stay bounded

The architecture must make it easy to stop, downgrade confidence, or return `unsupported` when complexity exceeds supported limits.

### 3. Support explanation

Every major stage should produce enough structured information that the engine can explain its conclusions.

### 4. Be compositional

The engine should be built from stages and IRs that connect cleanly, rather than from one giant monolithic pass.

### 5. Allow coexistence with the current scanner

The new engine must remain isolated and internally coherent while it is under development.

## High-Level Summary

The new engine should follow a staged pipeline similar in spirit to the current scanner, but with very different internal analysis depth.

At a high level, the pipeline is:

1. file and module discovery
2. source parsing and source anchors
3. module graph construction
4. symbol resolution
5. bounded expression and value evaluation
6. render graph construction
7. render subtree IR construction
8. selector constraint construction
9. stylesheet reachability attachment
10. selector satisfiability analysis
11. rule execution
12. explanation assembly and reporting

The main architectural shift is:

- the current scanner reasons mainly about files, classes, and reachable stylesheets
- the new engine reasons about files, symbols, values, render structure, selectors, and uncertainty

## Main Architectural Principle

The engine should use several linked internal models rather than one giant all-purpose graph.

The most important models are:

- module graph
- symbol model
- abstract values
- render graph
- render subtree IR
- selector constraint IR
- reachability summaries
- analysis traces

Each stage should consume one or more of those models and produce the next one.

## The First Bounded Slice

Before detailing the general pipeline, it is helpful to define the first supported slice clearly.

### First supported target

The first target capability is:

- simple ancestor-qualified selector satisfiability

Example:

```css
.topic-manage-page .topic-manage-page__title-skeleton {
  width: min(16rem, 100%);
}
```

The first slice should eventually be able to reason about whether the engine can find a plausible rendered structure where:

- some ancestor element has class `topic-manage-page`
- some descendant element has class `topic-manage-page__title-skeleton`
- the stylesheet is available in that render context

### First slice limits

The first slice should stay bounded.

Recommended initial limits:

- same-file intrinsic JSX support first
- same-file class expression evaluation first
- direct local component expansion only when simple and bounded
- no general render-prop evaluation
- no arbitrary list expansion
- explicit `unsupported` for complex selector shapes
- explicit `budget-exceeded` when expansion exceeds configured limits

This slice is intentionally small, but it is already beyond the current scanner.

## Stage 1: File And Module Discovery

## Purpose

Identify source files and relevant imported resources.

## Responsibilities

- collect candidate source files
- collect CSS files
- record imported external CSS resources where needed later
- normalize project-relative paths

## Output

- discovered file records
- initial module candidates

## Notes

This stage is intentionally close to the current scanner in spirit, but it should feed the new engine's module graph rather than the old file-facts pipeline.

## Stage 2: Source Parsing And Anchoring

## Purpose

Parse source files into syntax trees and record stable source anchors.

## Responsibilities

- parse TypeScript/JavaScript/JSX source
- identify declarations, imports, exports, JSX nodes, and class-bearing expressions
- create `SourceAnchor` references for later explanation

## Output

- parsed source cache
- raw syntax-level extraction records
- source anchors

## Why this is a separate stage

The engine will need provenance throughout later stages.
Anchors should be created once and reused, not recomputed in ad hoc ways later.

## Stage 3: Module Graph Construction

## Purpose

Build the source-level graph of modules, imports, exports, and top-level symbols.

## Responsibilities

- create module nodes
- create import edges
- create export edges
- associate top-level symbol declarations with modules

## Output

- `ModuleGraph`

## Key boundary

This stage should model source relationships only.
It should not attempt to reason about runtime-rendered structure.

## Stage 4: Symbol Resolution

## Purpose

Resolve what names refer to within and across modules.

## Responsibilities

- resolve local bindings
- resolve imported bindings
- identify component symbols
- identify helper/function symbols
- identify unresolved or unsupported symbol references explicitly

## Output

- symbol table or symbol registry
- symbol-resolution results attached to relevant syntax records

## Why this matters

This is the first stage where the engine starts to answer:

- what does this identifier mean?

That is a precondition for value flow, helper analysis, and component expansion.

## Stage 5: Bounded Expression And Value Evaluation

## Purpose

Evaluate a meaningful subset of expressions into abstract values.

## Responsibilities

- evaluate literals and simple expressions
- evaluate bounded template literals
- evaluate arrays and objects where feasible
- evaluate conditionals and logical expressions where feasible
- evaluate class-bearing expressions into abstract class sets
- represent unsupported or over-budget cases explicitly

## Output

- `AbstractValue`
- `AbstractClassSet`
- value traces

## Important design point

This stage should not try to answer selector questions yet.

It is responsible for saying:

- what values might this expression produce?

not:

- what CSS selector can match?

## Stage 6: Render Graph Construction

## Purpose

Build the component-to-component composition graph.

## Responsibilities

- detect which components render which other components
- attach prop summaries to render edges
- preserve multiple render sites
- preserve uncertainty where component targets are unresolved

## Output

- `RenderGraph`

## Why this is distinct from render subtree IR

The render graph answers:

- which components call which components?

It does not yet answer:

- what rendered elements do those components produce?

That separation keeps the architecture easier to reason about.

## Stage 7: Render Subtree IR Construction

## Purpose

Construct approximate rendered subtrees for bounded components and JSX regions.

## Responsibilities

- normalize intrinsic JSX elements into `RenderElementNode`
- normalize fragments
- preserve conditionals as branches
- preserve component calls as explicit nodes
- represent `children` and subtree props as slots or subtree payloads
- attach class sets to rendered elements

## Output

- `RenderSubtreeValue`

## Why this stage is central

This is where the engine becomes capable of approximate DOM-like reasoning.

This stage is the bridge between:

- source/program analysis

and:

- selector satisfiability analysis

## First-slice guidance

For the first bounded slice, this stage should support:

- same-file intrinsic JSX
- fragments
- class-bearing elements
- bounded conditionals

Local component expansion should be added only after the same-file case is stable.

## Stage 8: Selector Constraint Construction

## Purpose

Parse CSS selector branches into normalized matching constraints.

## Responsibilities

- parse CSS selectors
- normalize simple supported shapes into selector constraints
- preserve unsupported selector forms explicitly
- retain source anchors and at-rule context

## Output

- `SelectorBranchIR`
- `SelectorConstraint`

## First-slice guidance

The first slice should focus on:

- same-node class conjunction
- ancestor-descendant class relationships

This is enough to support:

- compound selector reasoning
- ancestor-qualified selector satisfiability

Parent-child selectors can come next if needed.

## Stage 9: Reachability Attachment

## Purpose

Determine where stylesheets are available in the new model.

## Responsibilities

- attach stylesheet availability to relevant module, component, or render contexts
- preserve definite versus possible availability
- connect CSS resources to the render reasoning path

## Output

- `ReachabilitySummary`

## Important note

Even though the new engine is richer, stylesheet availability is still necessary.

A selector may be structurally satisfiable but irrelevant if the stylesheet is not available in that context.

## Stage 10: Selector Satisfiability Analysis

## Purpose

Evaluate whether selector constraints can match approximate rendered subtrees under known bounded analysis.

## Responsibilities

- match selector constraints against render subtree IR
- consider structural context
- consider class certainty
- consider stylesheet reachability
- distinguish semantic possibility from technical unknown

## Output

- selector match results
- traces explaining why a match is:
  - definite
  - possible
  - unsupported
  - budget-exceeded
  - not found under bounded analysis

## First-slice guidance

For the first target, this stage should support answering:

- can `.ancestor .child` match under same-file bounded analysis?

This is the first flagship capability for the new engine.

## Stage 11: Rule Execution

## Purpose

Run new-engine-native rules on top of the richer analysis model.

## Responsibilities

- consume selector match results
- consume class-flow and render-structure conclusions
- emit findings with confidence and metadata

## Output

- new-engine findings
- new-engine summary data

## Initial rule strategy

The first rule or rule-like output should be tightly aligned to the first target capability.

Good early candidates:

- experimental ancestor-qualified selector satisfiability finding
- debug-only selector satisfiability report
- comparison-only signal against current behavior

The point is to validate the engine architecture before broad rule migration.

## Stage 12: Explanation And Reporting

## Purpose

Make engine conclusions understandable.

## Responsibilities

- assemble traces into structured debug output
- expose technical explanation payloads for tests and debugging
- later support human-readable explanations if needed

## Output

- debug trace trees
- structured explanation metadata
- optional summarized human-readable explanations

## Product guidance

The first explanation mode can be technical and hidden by default.

It does not need to be polished prose at first.
It does need to be useful for maintainers.

## Cross-Cutting Architectural Concerns

These concerns affect multiple stages and should be treated as first-class architectural constraints.

## 1. Uncertainty Model

The architecture must distinguish semantic possibility from technical inability to answer.

At minimum, the engine should support internal states like:

- `definite`
- `possible`
- `not-found-under-bounded-analysis`
- `unsupported`
- `budget-exceeded`

Why this matters:

- `possible` means the engine found a plausible path
- `unsupported` means the engine could not reason about the case

Those are different product meanings and should not be collapsed too early.

## 2. Budgeting

Every stage with branching or cross-file expansion should be budget-aware.

Likely budgets include:

- maximum symbol hop depth
- maximum evaluator recursion
- maximum branch count
- maximum component expansion depth
- maximum selector complexity

When a budget is exceeded, the stage should emit explicit technical uncertainty rather than silently dropping information.

## 3. Explanation Preservation

Every major stage should preserve enough context for debugging.

This means:

- source anchors should flow through the pipeline
- trace objects should be attachable to decisions
- IRs should not throw away provenance too early

## 4. Determinism

The architecture must preserve deterministic behavior.

For the same project and the same budgets, the engine should produce:

- the same IRs
- the same selector-match results
- the same findings
- the same traces in stable order

## 5. Isolation From The Current Scanner

This architecture assumes the new engine is implemented inside:

- `src/static-analysis-engine/`

with:

- separate tests
- separate docs
- separate internal types

and no casual deep imports from the current scanner.

That isolation is part of the architecture, not just a repository preference.

## Parallelization Strategy

This architecture is staged, but staged does not mean "everything must run serially."

The important distinction is:

- some stages have real dependency ordering
- many tasks inside a stage can still run in parallel

## Plain-language summary

The pipeline should be understood as a dependency graph, not as one giant single-threaded procedure.

For example:

- selector satisfiability depends on render subtree IR
- render subtree IR depends on symbol and value reasoning
- symbol resolution depends on the module graph

Those are real ordering constraints.

But once a stage has the inputs it needs, much of the work inside that stage can often fan out across:

- files
- modules
- components
- selectors
- CSS resources

So the right model is:

- logically staged
- internally parallel-capable

## Where parallelization is naturally available

The following kinds of work are strong candidates for parallel execution:

- parsing source files
- parsing CSS files
- extracting per-file syntax anchors
- collecting top-level declarations per module
- normalizing selectors per CSS file
- building independent per-module summaries
- evaluating independent selector checks once render subtree IR exists

These tasks mostly operate on separate inputs and can usually be joined deterministically afterward.

## Where ordering is more real

The following areas have stronger inter-stage dependencies:

- module graph construction after discovery and parsing
- symbol resolution after the module graph exists
- bounded value evaluation when it depends on symbol resolution
- render graph and render subtree construction when they depend on resolved components and values
- selector satisfiability after render subtree IR and selector constraints exist

These stages are still compatible with internal parallel work, but they are not independent of one another.

## Where parallelization gets more complicated

Some parts of the engine are likely to involve shared caches, repeated refinement, or bounded recursion.

These include:

- cross-file symbol resolution
- helper and function summarization
- recursive component expansion
- value evaluation that depends on previously computed summaries
- any later fixpoint-style refinement work

These are still potentially parallelizable, but they require more careful coordination because:

- work items may depend on partially computed shared results
- caches need deterministic ownership rules
- repeated recomputation can erase the performance benefits if coordination is poor

## Architectural guidance for parallel-capable stages

Even before implementing concurrency, the architecture should be shaped so parallel execution remains possible later.

Recommended design choices:

- prefer explicit stage inputs and outputs
- avoid hidden global mutable state
- keep IR construction deterministic
- make caches stage-owned rather than globally ad hoc
- favor immutable or append-only intermediate data where practical
- join fan-out work through stable merge steps

These choices make the engine easier to reason about even if the first implementation is mostly single-threaded.

## Recommendation For Early Implementation

The first implementation of the static-analysis-engine does not need to aggressively parallelize everything.

The better near-term goal is:

- design the stages so they are parallel-friendly
- keep the dependency structure explicit
- add parallel execution where it provides clear value

In practice, that likely means:

1. keep the top-level stage ordering clear
2. allow per-file parsing and extraction to fan out
3. allow per-selector or per-resource analysis to fan out once prerequisite IRs exist
4. postpone more complicated concurrent summary/evaluator strategies until the core architecture is stable

## Summary

This architecture should be treated as:

- sequential at the stage-dependency level
- parallel-capable inside many stages

That gives the project the best balance of:

- conceptual clarity
- deterministic behavior
- future performance headroom

## The First Vertical Slice

To keep implementation grounded, the first vertical slice should likely be:

1. parse same-file JSX
2. build module graph and symbol bindings for the file
3. evaluate class expressions into abstract class sets
4. build a simple render subtree IR for same-file intrinsic JSX
5. parse a simple ancestor-qualified selector
6. determine whether that selector is satisfiable against the subtree
7. emit a technical debug explanation

That slice proves:

- the architecture can support genuinely new reasoning
- the IRs are useful
- explanation data can survive the pipeline

Only after that should the engine expand to local component inlining and then cross-file reasoning.

## What This Architecture Does Not Yet Decide

This document intentionally does not fully specify:

- the exact public API of the new engine
- the final user-facing output format
- the final migration strategy for every current rule
- full support for render props, loops, or framework-specific patterns

Those need later design work.

This architecture doc is focused on the bounded core pipeline.

## Recommended Near-Term Follow-Up Docs

After this document, the most useful next architecture-adjacent notes are likely:

- `uncertainty-and-decision-model.md`
- `module-and-symbol-graph.md`
- `abstract-values.md`
- `render-ir.md`
- `selector-analysis.md`
- `roadmap.md`

## Definition Of Done For This Architecture Step

This architecture step is done when:

- the project has a clear staged pipeline for the new engine
- the first bounded target capability is reflected in that pipeline
- stage boundaries are explicit
- uncertainty, budgeting, explanation, and isolation are treated as architectural concerns rather than afterthoughts

## Recommendation

Adopt this architecture as the working pipeline for the static-analysis-engine track.

Then implement it in the smallest meaningful vertical slice:

- same-file ancestor-qualified selector satisfiability

That gives the project a realistic first win while keeping the architecture honest and bounded.
