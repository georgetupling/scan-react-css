# Static Analysis Engine Requirements

## Purpose

This document defines the high-level requirements for a new version of `scan-react-css` backed by a static analysis engine.

This work should be treated as a project-within-the-project.

The current scanner remains the production implementation while this new direction is under development.
The static-analysis-engine work should be developed in isolation, with its own docs, code, tests, and internal design decisions, until it is mature enough to replace or subsume the current pipeline deliberately.

## Problem Statement

The current scanner is strong at file-level and class-token-level analysis.

It can answer questions such as:

- where classes are referenced in React source
- where classes are defined in CSS
- which CSS files are reachable from which source files
- whether some broad ownership and reachability rules are violated

That architecture is effective for many practical cases, but it has a hard boundary:

- it reasons mainly about source files, CSS files, and extracted class tokens
- it does not model enough program behavior or rendered structure to answer many structure-sensitive and abstraction-sensitive questions

This creates several persistent limitations:

- wrapper and slot patterns can produce false positives
- ancestor-qualified selectors are difficult or impossible to reason about accurately
- file-level reachability is only a rough proxy for rendered selector satisfiability
- class values built through helpers, props, imported constants, or shared abstractions remain only partially understood
- confidence is often limited by the lack of value-flow and render-structure reasoning

In short:

- the current tool is very good at "what classes and CSS files exist and connect at a file level?"
- it is much weaker at "what might actually be rendered, why might it be rendered that way, and can this selector match that rendered output?"

## Motivation

The static analysis engine direction exists to address those limitations directly.

The aim is not to perfectly simulate React or arbitrary JavaScript.
The aim is to build a bounded, useful, explainable approximation of enough program behavior to answer richer CSS questions.

The main motivations are:

- reduce false positives caused by wrapper, slot, and prop-driven composition
- reduce false positives caused by abstraction-heavy class construction
- answer selector-satisfiability questions that the current scanner cannot answer
- support stronger confidence modeling for both positive and negative conclusions
- create a foundation for future rules that depend on rendered structure and value flow

This is a strategic direction, not a patch-level improvement.

## Product Goal

The goal is to replace the current scanner with a new version backed by a bounded static analysis engine that can reason about both:

- what might be rendered
- why it might be rendered that way

That means the new system should eventually be able to reason about:

- values flowing through variables
- props flowing into components
- helper function behavior
- branching logic
- imported constants and helpers across files
- bounded cross-file evaluation
- approximate rendered subtrees with preserved uncertainty
- whether CSS selectors can match those approximate rendered subtrees

## Non-Goal

The new engine is not intended to:

- perfectly understand arbitrary JavaScript or TypeScript
- become a full compiler or full React runtime simulator
- execute application code
- guarantee runtime truth in all cases
- silently overclaim certainty

The engine must stay bounded and explicit about uncertainty.

## Project-Within-A-Project Rules

During development, the static-analysis-engine work must remain sequestered from the current implementation.

### Isolation requirement

The new engine must live in its own directory structure and must not depend on ad hoc internal reuse from the current scanner pipeline.

Reason:

- this work is exploratory and architectural
- accidental coupling would make it hard to reason about what belongs to the old model versus the new one
- isolation reduces the risk of slowly contaminating the current implementation with half-complete assumptions from the new direction

### Allowed reuse

Reuse of existing ideas is allowed.

Reuse of existing code is allowed only when done deliberately and copied or wrapped in a way that keeps the new subsystem independently coherent.

In practice, that means:

- prefer re-implementing or explicitly porting small pieces into the new subsystem rather than reaching across directories
- avoid direct cross-talk where new-engine code calls deep old-engine helpers as if both pipelines were one system already

### Development expectation

The old and new implementations should be able to coexist for an extended period.

This implies:

- separate docs
- separate tests
- separate internal data structures
- separate staged milestones

## Brief Summary Of The Technical Design

At a high level, the new system will replace the current file-centric CSS reasoning model with a bounded static analysis engine that combines:

1. module and symbol resolution
2. abstract value evaluation
3. prop and helper flow analysis
4. render-structure modeling
5. selector constraint matching
6. explainable rule execution on top of the resulting model

The likely architecture will use several linked layers rather than one giant graph.

### Likely high-level layers

- module and symbol graph
- render graph
- element-tree intermediate representation
- abstract class/value model
- selector-constraint model
- reachability and route-context model
- explanation and trace metadata

### Core principle

The engine should operate on normalized internal models rather than re-deriving behavior directly from raw AST nodes inside rules.

### Another core principle

The engine must preserve uncertainty explicitly.

It should prefer:

- definite
- possible
- unknown

over pretending that every question has a binary answer.

## Definition Of Done

This direction is done only when the new engine is mature enough to replace the current scanner intentionally.

That means all of the following should be true.

### Functional done criteria

- The new engine can scan realistic React projects end to end.
- It can answer the current scanner's core rule questions at least as well as the current production implementation.
- It materially improves behavior on the key pain points that motivated the redesign.
- It supports richer selector and structure-sensitive reasoning that the current engine cannot support cleanly.
- It emits findings with explicit confidence and explainable supporting metadata.

### Architectural done criteria

- The new engine has its own coherent internal architecture.
- The main reasoning path is powered by the static-analysis-engine model, not by falling back to old-engine internals for core behavior.
- Major subsystems are documented and testable in isolation.

### Quality done criteria

- Performance is acceptable on representative projects.
- Findings remain deterministic.
- Explanations are understandable enough for debugging and user trust.
- The new engine's test suite demonstrates correctness on the major targeted capability areas.

### Replacement done criteria

- A deliberate migration plan exists for replacing or retiring the current implementation.
- The team can explain what behavior changes are intentional versus accidental.
- Product docs are updated to reflect the new engine as the primary implementation model.

## Core Requirements

The new engine must be able to perform the following categories of work.

## 1. Module And Symbol Resolution

The engine must understand what code entities refer to across files.

### Requirements

- Resolve imports and exports across modules.
- Resolve component identities across files.
- Resolve local bindings and imported bindings.
- Distinguish between local values, imported values, and unresolved values.
- Support enough symbol tracing to connect JSX usage, helper calls, and class construction across modules.

### Why this matters

Without symbol resolution, the engine cannot connect:

- component calls to component definitions
- helper calls to helper implementations
- imported constants to their actual values

## 2. Expression And Value Evaluation

The engine must evaluate a meaningful bounded subset of JS and TS expressions.

### Requirements

- Evaluate literals, template literals, arrays, objects, and property access where feasible.
- Evaluate conditionals and logical expressions where feasible.
- Track uncertainty instead of collapsing difficult cases to misleading certainty.
- Support bounded evaluation of common class-construction and prop-construction patterns.
- Degrade gracefully when evaluation exceeds supported complexity.

### Why this matters

Many React class names and render decisions are not written as direct string literals.

## 3. Prop And Value Flow Into Components

The engine must model how values move into component render output.

### Requirements

- Track prop values passed into component calls.
- Model how those props affect JSX structure and class assignment.
- Support `children` as a first-class subtree flow mechanism.
- Support JSX-valued props and named slot-like props as subtree flow mechanisms.
- Preserve uncertainty when prop values are only partially known.

### Why this matters

This is necessary for wrapper, slot, and layout patterns.

## 4. Helper And Shared-Abstraction Modeling

The engine must reason about helpers and reusable abstractions that influence classes or structure.

### Requirements

- Support bounded modeling of same-file and cross-file helper behavior.
- Represent helper results as abstract values rather than forcing exact runtime values.
- Allow function summaries so frequently used helpers do not require full re-evaluation every time.
- Support explicit "unsupported" or "unknown" states when helper behavior is too dynamic.

### Why this matters

Real React code often pushes class logic into helpers, factories, and reusable wrappers.

## 5. Render Graph Construction

The engine must understand which components render which other components.

### Requirements

- Build a render graph describing component composition.
- Preserve branching and alternative render paths.
- Bound traversal depth and branching cost.
- Distinguish component-level composition from DOM-like element nesting.

### Why this matters

This is the bridge between module reasoning and approximate rendered structure.

## 6. Approximate Rendered Subtree Modeling

The engine must build approximate rendered output structures, not just token sets.

### Requirements

- Represent intrinsic elements, fragments, component calls, conditionals, slots, and unknown regions.
- Preserve parent/child relationships.
- Attach abstract class/value information to element-like nodes.
- Represent alternative branches without forcing a single exact tree.
- Support bounded inlining or expansion of rendered component output.

### Why this matters

Selector reasoning depends on structure, not just token existence.

## 7. CSS Selector Constraint Modeling

The engine must model CSS selectors as match constraints rather than only as loose class mentions.

### Requirements

- Normalize selector branches into internal constraint forms.
- Support at least:
  - same-node class conjunction
  - ancestor-descendant relationships
  - parent-child relationships
- Preserve uncertainty for selectors too complex to evaluate fully.
- Keep selector modeling explainable enough for debugging.

### Why this matters

This is what allows the engine to ask whether a selector can plausibly match a rendered subtree.

## 8. Selector Satisfiability Analysis

The engine must be able to ask whether a selector can match any known approximate rendered output.

### Requirements

- Evaluate selector constraints against approximate rendered subtrees.
- Distinguish between:
  - definitely satisfiable
  - possibly satisfiable
  - unsupported or unknown
  - not satisfiable under known bounded analysis
- Combine selector reasoning with stylesheet reachability.

### Why this matters

This is one of the biggest practical unlocks of the new engine.

## 9. Reachability In The New Model

The engine must retain and extend the concept of CSS reachability.

### Requirements

- Model stylesheet availability in the richer engine rather than dropping reachability entirely.
- Combine file-level or route-level stylesheet availability with render-structure reasoning.
- Support questions like:
  - can this selector match?
  - and is the stylesheet even available where it could match?

### Why this matters

Selector satisfiability without reachability would still be incomplete.

## 10. Confidence And Uncertainty

The engine must make uncertainty explicit.

### Requirements

- Preserve definite versus possible conclusions throughout the pipeline.
- Avoid silent overconfidence.
- Make "unknown because unsupported" distinguishable from "no evidence found."
- Allow findings to depend on both severity and confidence.

### Why this matters

A richer engine is only useful if users can trust its boundaries.

## 11. Explanation And Traceability

The engine must be explainable enough for maintainers and users to debug.

### Requirements

- Retain enough trace information to explain why a conclusion was reached.
- Support developer-facing investigation of:
  - symbol resolution
  - prop flow
  - class flow
  - render expansion
  - selector matching
- Make it possible to understand why the engine said "yes," "possible," or "unknown."

### Why this matters

Without explanation, a richer engine becomes opaque and hard to trust.

## 12. Performance And Budgeting

The engine must be bounded and practically runnable.

### Requirements

- Define explicit budgets for recursion, branching, cross-file hops, and selector complexity.
- Fail soft when budgets are exceeded.
- Use caching and summaries where needed.
- Remain deterministic under the same inputs and budgets.
- Provide enough instrumentation to understand major cost centers.

### Why this matters

A theoretically powerful engine that is too slow or too unstable is not a viable replacement.

## 13. Rule Execution On Top Of The New Engine

The static analysis engine must support real product rules, not just internal experiments.

### Requirements

- Expose a normalized model suitable for rule execution.
- Support migration or re-implementation of current rule families on top of the new engine.
- Enable new rules that depend on rendered structure and value flow.
- Keep rule contracts stable enough that findings remain deterministic and testable.

### Why this matters

The engine is only valuable if it powers the scanner's product behavior.

## 14. Coexistence With The Current Scanner During Development

The development plan must support parallel existence of old and new systems.

### Requirements

- The current scanner remains the source of truth for shipped behavior until replacement is intentional.
- The new engine has separate docs and tests.
- The new engine can be evaluated without destabilizing the current production path.
- Migration decisions are made deliberately rather than gradually through accidental coupling.

### Why this matters

This protects both velocity and clarity.

## Practical Questions The New Engine Should Eventually Be Able To Answer

This section gives concrete examples of the type of questions the engine should eventually be able to answer with useful confidence.

- Can selector `.page .title` match any known rendered element?
- Can selector `.toolbar > .button` match any known rendered element?
- Does a wrapper component actually insert consumer-provided markup in a way that satisfies wrapper-owned selectors?
- Does a component ever emit both classes required by a compound selector?
- Is a contextual selector branch likely dead because the required structure never appears?
- Is a prop-driven modifier class realizable, only possible, or unreachable?
- Are some selectors satisfiable only on some known render paths?
- Does a passed `children` subtree or JSX-valued prop satisfy a selector owned by another component's stylesheet?

## Out-Of-Scope For The First Requirements Baseline

These requirements should not force the very first iteration to support every possible edge case.

The initial static-analysis-engine project does not need to fully support:

- arbitrary runtime data dependence
- arbitrary render props
- full general-purpose JS evaluation
- CSS-in-JS runtime systems
- framework-specific transforms not explicitly modeled
- perfect understanding of every React abstraction style

Those may remain future expansions.

## Recommended First Milestones

This document is not the full implementation plan, but it should imply a sensible milestone order.

Suggested early sequence:

1. Define new-engine directory structure and architectural boundaries.
2. Define new core IRs and type shapes.
3. Build module and symbol resolution for a bounded subset.
4. Build bounded expression evaluation for values relevant to classes and JSX structure.
5. Build a render graph and minimal rendered-subtree IR.
6. Add initial selector-constraint matching.
7. Reproduce one or two high-value currently-unsolved cases end to end.
8. Expand only after explanation, performance, and determinism are understood.

## Success Criteria

This new direction should be considered successful if it eventually produces:

- materially better accuracy on the motivating hard cases
- richer and more trustworthy explanations
- support for selector and wrapper questions that the current scanner cannot answer
- a maintainable and bounded subsystem rather than an accidental pile of heuristics

## Recommendation

Use this requirements document as the top-level charter for the static-analysis-engine track.

It should guide:

- design notes
- architectural decomposition
- milestone planning
- test planning
- replacement criteria

The key framing is:

- this is not "add a few smarter heuristics"
- this is "build a new bounded analysis engine beside the old one, prove it, and only then replace the old one deliberately"
