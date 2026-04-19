# Static Analysis Engine Directory Structure And Architectural Boundaries

## Purpose

This document defines the initial directory structure and architectural boundaries for the static-analysis-engine track.

This is the first concrete design step for the new engine effort.

The goal is to make the new subsystem:

- isolated enough to evolve safely beside the current scanner
- structured enough to support serious architectural work
- explicit enough that future contributors can tell what belongs to the new engine and what still belongs to the current implementation

## Why this document exists

The new engine is not intended to be a small extension of the current scanner.

It is a project-within-the-project.

That means we need more than a vague promise to "keep it separate."
We need a concrete answer to questions like:

- where should the new code live?
- what code is allowed to depend on what?
- what kinds of reuse are allowed?
- how do we avoid accidental cross-talk between the old and new systems?

This document answers those questions at a structural level.

## Design Goals

The directory structure and boundaries should support the following goals.

### 1. Isolation during development

The new engine must be able to grow without destabilizing the current production scanner.

### 2. Coherent internal architecture

The new engine should be organized around its own concepts, not around the folders of the old scanner.

### 3. Easy comparison with the current implementation

It should be possible to run the current and new approaches side by side during development and testing.

### 4. Low accidental coupling

Contributors should not be able to casually import deep old-engine helpers into the new system just because they happen to exist.

### 5. Deliberate migration later

If the new engine succeeds, it should be possible to migrate product behavior intentionally rather than untangling accidental coupling after the fact.

## High-Level Boundary Decision

The static-analysis-engine track should have its own code root, its own tests, and its own docs.

It should not be spread across existing `src/` folders in a way that mixes old and new implementation concerns.

The cleanest initial structure is:

- docs under `docs/static-analysis-engine/`
- implementation under `src/static-analysis-engine/`
- tests under `test/static-analysis-engine/`

This keeps the subsystem easy to reason about and easy to search.

## Proposed Directory Structure

Recommended initial layout:

```text
docs/
  static-analysis-engine/
    requirements.md
    directory-structure-and-boundaries.md
    architecture.md
    module-and-symbol-graph.md
    abstract-values.md
    render-ir.md
    selector-constraints.md
    roadmap.md

src/
  static-analysis-engine/
    index.ts
    types/
    config/
    entry/
    parser/
    module-graph/
    symbol-resolution/
    abstract-values/
    evaluator/
    render-graph/
    render-ir/
    selector-analysis/
    reachability/
    rule-engine/
    runtime/
    explain/
    support/
    adapters/
    experimental/

test/
  static-analysis-engine/
    unit/
    feature/
    integration/
    fixtures/
    support/
```

This is not a commitment to every folder immediately.
It is a target structure that should guide incremental implementation.

## Directory Responsibilities

Each top-level new-engine directory should have a narrow purpose.

## `docs/static-analysis-engine/`

This directory is the design and planning home for the new engine.

It should contain:

- requirements
- architectural notes
- IR definitions
- milestone plans
- boundary decisions
- migration notes

It should not become a dumping ground for generic project docs.

Anything specifically about the new engine belongs here.

## `src/static-analysis-engine/`

This is the implementation root for the new engine.

Nothing outside this root should be necessary to understand the internal shape of the new subsystem.

### `index.ts`

This should be the public entrypoint for the new engine's internal API.

Initially, this can be small.
Its main job is to define a stable top-level surface for the new subsystem.

### `types/`

Shared types for the new engine only.

Examples:

- module graph node types
- symbol reference types
- abstract value types
- render IR node types
- selector constraint types
- explanation metadata types

Reason for a dedicated directory:

- the new engine will likely have many internal types
- they should not be mixed into the current runtime/type files until migration is intentional

### `config/`

Configuration types and normalization for the new engine only.

Initially this may be small, especially if the early prototype uses hardcoded budgets.

Longer term, this should contain:

- engine budgets
- feature toggles
- tracing/debug options
- compatibility or migration flags

### `entry/`

Top-level orchestration for the new engine pipeline.

This should contain stages such as:

- scan entrypoint
- pipeline coordination
- high-level stage execution order

Why this directory matters:

- it separates orchestration from the internals of individual stages

### `parser/`

Parsing and syntax extraction utilities specific to the new engine.

This may eventually include:

- JSX subtree extraction helpers
- selector normalization helpers for the new engine
- lightweight syntax adapters for building the new IRs

Important note:

- this directory is not just a clone of the current `src/parser`
- only parsing behavior that is needed by the new engine should live here

### `module-graph/`

Construction of the module-level graph.

This should answer questions like:

- what modules exist?
- what imports and exports connect them?
- which modules define components, values, and helpers?

### `symbol-resolution/`

Logic for resolving names and bindings across modules.

Examples:

- what does `Button` refer to here?
- where does `variantMap` come from?
- is `joinClasses` a local function or an imported helper?

This is separate from the module graph because:

- the graph captures relationships
- resolution answers name-binding questions over that graph

### `abstract-values/`

The new engine's value model lives here.

Examples:

- exact strings
- sets of possible strings
- object shapes
- arrays
- unknown values
- values with definite/possible class sets

This should remain a clean internal subsystem, because many later stages depend on it.

### `evaluator/`

The bounded expression evaluator lives here.

This stage will likely consume:

- ASTs
- symbol-resolution results
- abstract value definitions

and produce:

- bounded compile-time approximations of values

This is one of the most architecturally sensitive parts of the new engine.

### `render-graph/`

Component-to-component render relationships live here.

This is the layer that answers:

- which components render which other components?

It is distinct from rendered-element modeling.

### `render-ir/`

Approximate rendered subtree structures live here.

This is where the new engine starts to look like:

- possible rendered elements
- possible children
- possible slot insertion points
- possible class assignments

This should be kept separate from the evaluator because:

- value reasoning and structural reasoning are related but not the same problem

### `selector-analysis/`

Selector normalization and satisfiability analysis live here.

This should include:

- selector constraint IR
- matching logic
- uncertainty handling for unsupported selector shapes

### `reachability/`

The richer engine still needs a reachability layer.

This directory should contain the new engine's stylesheet availability reasoning, not the old file-level reachability implementation.

Initially it may reuse some ideas from the old model.
Architecturally, though, it should be a new subsystem.

### `rule-engine/`

Rule execution on top of the new engine model.

This directory should eventually support:

- new-engine-native rule inputs
- finding construction
- rule registration
- testable rule execution over the new model

Important boundary:

- do not port old rules here blindly
- re-implement rules only when the underlying new-engine model for that rule is ready

### `runtime/`

Runtime-facing types and result shapes for the new engine.

This may eventually include:

- scan result shape
- engine warnings
- debug trace payloads
- summary output types

### `explain/`

Explanation and trace support.

This directory exists because explanation should be treated as a first-class architectural concern, not as debug print statements scattered across the engine.

Examples:

- why a symbol resolved the way it did
- why a value became `unknown`
- why a selector was considered satisfiable
- why a rule conclusion was `possible` rather than `definite`

### `support/`

Internal shared helpers for the new engine only.

This is where small reusable utilities can live when they do not belong to a domain-specific directory.

This directory should stay disciplined.
It should not become a vague junk drawer.

### `adapters/`

This directory is for deliberate boundaries between:

- the new engine
- the current scanner
- shared external surfaces

Examples:

- compatibility shims
- comparison harnesses
- temporary migration adapters

Why this matters:

- if the new engine needs to interoperate with the current scanner during development, those contact points should be explicit and localized

### `experimental/`

Optional area for high-risk prototypes that are not yet part of the stable new-engine architecture.

Use this sparingly.

The purpose is:

- allow experiments without pretending they are already stable architectural decisions

## Test Directory Structure

The new engine should have its own tests under `test/static-analysis-engine/`.

Recommended layout:

```text
test/static-analysis-engine/
  unit/
  feature/
  integration/
  fixtures/
  support/
```

### `unit/`

Small, fast tests for:

- abstract value logic
- selector constraint parsing
- symbol resolution helpers
- evaluator decisions

### `feature/`

Mid-level tests for:

- render graph construction
- render IR building
- bounded cross-file evaluation
- explanation traces

### `integration/`

End-to-end tests for:

- representative React projects
- real multi-file wrapper patterns
- selector satisfiability behavior

### `fixtures/`

Fixture content used by the new engine only.

Do not mix these fixtures into the old scanner's fixture directories unless both engines intentionally share a stable compatibility fixture.

### `support/`

Test builders and utilities for the new engine only.

## Architectural Boundary Rules

These are the most important practical rules in this document.

## Rule 1: No deep imports from the current scanner into the new engine

New-engine implementation code under `src/static-analysis-engine/` must not import deep internals from:

- `src/facts`
- `src/model`
- `src/rules`
- `src/runtime`
- `src/class-expression-evaluator`
- other old-engine implementation directories

Why:

- this would create hidden coupling
- it would blur the meaning of "new engine"
- it would make later replacement harder, not easier

## Rule 2: Shared concepts may be re-implemented or explicitly ported

If the new engine needs something conceptually similar to the current scanner, the preferred approach is:

- explicitly port it into the new subsystem
- or wrap it behind a deliberate adapter boundary

Examples:

- selector normalization
- class-token extraction ideas
- summary-building concepts

The important part is:

- the new engine should own its own reasoning path

## Rule 3: Temporary interoperability must be explicit

If the new engine needs to compare against or interoperate with the current engine during development, that must happen through:

- `src/static-analysis-engine/adapters/`

or another explicitly named compatibility boundary.

It must not happen through scattered imports from old-engine internals.

## Rule 4: New-engine tests should test new-engine behavior directly

Tests under `test/static-analysis-engine/` should exercise:

- the new engine entrypoints
- the new engine IRs
- the new engine rule execution

They should not be mostly thin wrappers around old-engine tests.

## Rule 5: Current shipped behavior remains owned by the current scanner

Until migration is intentional:

- the old scanner remains the source of truth for shipped behavior
- the new engine remains an in-development subsystem

This avoids ambiguous ownership of production behavior.

## Allowed Reuse Policy

Reuse is allowed, but only deliberately.

### Allowed

- copying small, stable utility ideas into the new subsystem
- porting parsing logic with clear ownership transfer into the new subsystem
- building explicit adapters for controlled comparison or migration
- using the same external libraries in both systems

### Not allowed

- casually importing old-engine internals because they are convenient
- treating old-engine types as the canonical types for the new subsystem
- letting new-engine rule behavior depend directly on old-engine project-model behavior

## Proposed Initial Code Skeleton

The initial filesystem skeleton does not need to include every future directory immediately.

A reasonable first implementation skeleton is:

```text
src/static-analysis-engine/
  index.ts
  types/
    index.ts
  entry/
    scan.ts
  module-graph/
    index.ts
  symbol-resolution/
    index.ts
  abstract-values/
    index.ts
  evaluator/
    index.ts
  render-graph/
    index.ts
  render-ir/
    index.ts
  selector-analysis/
    index.ts
  support/
    index.ts
```

And for tests:

```text
test/static-analysis-engine/
  unit/
  support/
```

This keeps the initial footprint small while preserving the architectural direction.

## Boundary With Public Product Surface

At first, the new engine should not replace the root package exports or CLI behavior.

That means:

- do not immediately wire the new engine into `src/index.ts`
- do not immediately route the CLI through it

Instead, the new engine should be invocable through:

- its own internal entrypoint
- dedicated tests
- optional comparison harnesses later

Only after the engine is mature should the package-level public surface be reconsidered.

## Documentation Expectations

Every major new-engine subsystem should eventually have a short design note under `docs/static-analysis-engine/`.

Recommended next docs after this one:

- `architecture.md`
- `core-irs.md`
- `module-and-symbol-graph.md`
- `abstract-values.md`
- `render-ir.md`
- `selector-analysis.md`
- `migration-strategy.md`

These docs should describe the new subsystem in its own terms, not only by contrast with the old scanner.

## Migration Philosophy

This structure is intentionally conservative.

It assumes:

- the old scanner will remain active for a while
- the new engine will need room to make different architectural decisions
- some ideas may be abandoned or reworked before replacement becomes realistic

That is healthy.

The goal is not to migrate immediately.
The goal is to create a safe and disciplined environment in which the new engine can become good enough to justify migration later.

## Definition Of Done For This Design Step

This design step is done when:

- the team agrees on `docs/`, `src/`, and `test/` roots for the new engine
- the directory-level responsibilities are clear
- architectural boundary rules are explicit
- "no cross-talk" has a practical meaning, not just a slogan
- the initial code skeleton can be created without ambiguity

## Recommendation

Adopt the new engine as a clearly separated subsystem rooted at:

- `docs/static-analysis-engine/`
- `src/static-analysis-engine/`
- `test/static-analysis-engine/`

and enforce explicit architectural boundaries from the start.

That will cost a little extra ceremony early on, but it will save substantial confusion later when the subsystem grows and the pressure to "just reuse the old helper" becomes stronger.
