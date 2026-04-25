# Current Engine Assessment

## Purpose

This document assesses the current state of `src/static-analysis-engine`.

It is intentionally focused on the engine itself:

- what it already does well
- where real functionality is missing
- where responsibility is leaking out of analysis and into rules
- which legacy-dependent engine-local code was removed
- where scope is still ambiguous

This document does not try to cover the package shell, CLI, config, or publishing story in depth. Those are covered separately.

## Current State Summary

The engine already has substantial core pieces in place.

Implemented areas include:

- source parsing
- module graph construction
- symbol collection and cross-file binding resolution
- bounded render IR construction
- render graph construction
- CSS rule and class-definition extraction
- selector normalization for a bounded subset of selectors
- stylesheet reachability analysis
- a normalized `ProjectAnalysis` projection for rule-facing entities, relations, and indexes

The pipeline in `entry/scan.ts` is coherent enough to act as the nucleus of the reboot.

The biggest problem is not that the engine has no structure. The biggest remaining problem is that the new project analysis contract is still a first slice and does not yet cover every product behavior.

## Real Functionality Gaps

These are engine gaps, not packaging or docs gaps.

### 1. `ProjectAnalysis` is still incomplete

The current pipeline now returns a normalized `projectAnalysis` object from the engine entry points.
Intermediate stage outputs remain local to the pipeline.
The projection currently covers:

- source files
- stylesheets
- components
- render subtrees
- class references
- class definitions
- selector queries
- reachability, match, import, and render relations
- deterministic indexes over common rule lookup paths

Remaining gaps include:

- CSS Module binding records
- ownership and organization records
- richer external CSS ingestion records
- stronger match semantics for dynamic and unsupported analysis

### 2. CSS Modules are not a first-class analysis concept

The current engine mostly recognizes CSS Modules by filename convention inside rules. That is not enough.

Missing engine capabilities:

- mapping `styles.foo` to a stylesheet and exported token
- distinguishing CSS Module references from plain class-string references
- building CSS Module-specific match edges
- supporting rules like missing CSS module class without legacy-model adapters

### 3. Dynamic class analysis is still narrow

`pipeline/render-model/abstract-values/classExpressions.ts` currently handles:

- exact string literals
- no-substitution template literals
- simple conditional expressions that collapse to string sets

It does not yet treat common real-world patterns as first-class:

- template expressions with interpolated branches
- array joins
- helper libraries such as `clsx` and `classnames`
- object syntax helpers
- string concatenation
- computed CSS Module property access

This is a real engine gap because class extraction is foundational.

### 4. Module resolution is intentionally bounded

The module graph is useful, but it is still limited in ways that matter for a production scanner:

- relative-path source resolution is the main supported path
- no first-class path alias model
- no package export map or tsconfig path awareness
- no explicit monorepo workspace resolution contract
- CSS import handling is still based on basic specifier classification

This is acceptable for a reboot, but it is a real functional limit.

### 5. Selector analysis only covers a bounded subset

The selector-analysis types are explicit about this, which is good.

Current bounded support is centered on:

- same-node class conjunction
- parent-child
- ancestor-descendant
- sibling relationships
- class-only selector steps

Still missing or only partially represented:

- pseudo classes and pseudo elements
- attribute selectors
- ids
- tag plus class combinations as first-class semantics
- negation beyond shallow extraction
- more complex at-rule semantics

The engine is honest about bounded analysis, but the product contract will need to state these limits clearly.

### 6. At-rule handling is narrow

The selector-analysis model currently only gives `media` a first-class type for at-rule context.

That leaves open behavior for:

- `supports`
- `layer`
- container queries
- nested combinations of multiple at-rules with semantics

The engine can preserve some context text, but it does not yet model the meaning of those contexts deeply.

### 7. External CSS support is partial

The engine can model external providers and project-wide remote stylesheet presence, but it does not actually provide a full external CSS ingestion contract on its own.

Open areas include:

- true remote fetching behavior
- caching semantics
- HTML discovery owned by the engine versus product shell
- direct external stylesheet definition ingestion as a first-class pipeline input

### 8. Missing rule families from the old product

Inside the engine itself, there is still no native replacement for several major product behaviors that used to exist outside it.

Notably absent from the current engine-native rule set:

- missing CSS class
- unreachable CSS
- unused CSS class
- CSS Module-specific missing and unused rules
- ownership and organization rules
- utility replacement and migration-style rules as first-class engine rules

These are not merely packaging gaps. They are current engine capability gaps.

## Responsibility Leakage

The main architectural leak is that rules are still doing analysis work.

### 1. Rules rebuild project-wide indexes

Rules must not rebuild project-wide indexes from intermediate engine stages.

It rebuilds:

- class definitions by stylesheet path
- reachable stylesheet paths by source file
- external imported stylesheet paths by source file
- candidate class tokens by source file

That logic belongs in normalized analysis output. The rule should ask the analysis:

- which external stylesheets are active for this reference?
- which reachable definitions match this token?
- did any declared provider satisfy it?

### 2. Rules still classify definition shapes locally

`duplicateCssClassDefinition.ts` and `redundantCssDeclarationBlock.ts` both carry non-trivial filtering and grouping logic over CSS definitions.

That suggests the engine is missing reusable definition-level analysis records such as:

- definition scope kind
- root/simple selector classification
- declaration signature
- comparable-definition groups

### 3. Rule inputs are still too raw

The rule layer currently receives stage outputs, not domain-specific rule inputs.

Because of that, a rule often has to understand:

- how class expressions encode certainty
- how reachability records are keyed
- how CSS files were analyzed
- how selector queries represent their constraint

Rules should mostly not care about the internal shape of stage outputs.

### 4. Legacy adapters were deleted

The current-scanner adapters were removed from `src/static-analysis-engine`.

Deleted files included:

- `runMigratedDefinitionAndUsageIntegrityRules.ts` is 379 lines
- `runMigratedOptimizationRules.ts` is 349 lines
- `buildEngineDefinitionReachability.ts` is 316 lines

Those files were not just bridging contracts. They reconstructed analysis concepts that the engine should expose natively if those rule families are meant to survive.

### 5. Comparison code was deleted

The `comparison/` area was removed because it existed to compare engine output to a deleted baseline scanner.

That comparison surface kept the engine public surface entangled with:

- baseline findings
- compatibility result types
- shadow-mode reporting

Those concerns are orthogonal to engine analysis.

## Deleted Legacy-Dependent Code

The following engine-local areas have been deleted because they only supported shadow-mode comparison against, or migration adapters for, the deleted scanner:

- `src/static-analysis-engine/comparison/`
- `src/static-analysis-engine/adapters/current-scanner/`
- `src/static-analysis-engine/runtime/compatTypes.ts`

Reason:

- they only exist to compare against or adapt to the removed scanner
- they blocked type-checking by importing deleted root modules
- they add conceptual noise to the engine public surface

The default engine export surface also no longer exports:

- all comparison exports in `src/static-analysis-engine/index.ts`

### Moved out of the engine

Rule execution now lives in `src/rules`.

Rules should consume `ProjectAnalysis` directly.

## Ambiguities In Scope Or Intended Design

These are the major questions the engine still leaves open.

### 1. Is the engine path-based or text-based?

Right now the main entry point is essentially text-based:

- source files are passed in as `{ filePath, sourceText }`
- CSS is passed in separately
- HTML is not a first-class engine input

That is a good core shape, but the project should make that explicit. Otherwise engine responsibilities will drift back toward filesystem work.

### 2. Should the engine emit findings directly, or only analysis?

The current engine returns rule results in the same top-level object as analysis outputs.

That is workable, but the more important contract should be `ProjectAnalysis`.

Decision needed:

- engine returns only analysis and rules live above it
- or engine returns both analysis and engine-native rule results

Either can work, but the boundary should be explicit.

### 3. How much unsupported analysis becomes a finding?

The code already distinguishes:

- resolved
- unsupported
- budget-exceeded
- unknown

That is a strength. The ambiguous part is product semantics:

- should unsupported selector analysis emit rule findings
- should it stay as diagnostics only
- when does bounded uncertainty become warning versus info

The engine should support both, but the intended product behavior should be defined.

### 4. Does ownership belong in the engine?

The deleted scanner had ownership-style concepts such as component, page, global, and utility.

The current engine does not have a strong native ownership model.

Decision needed:

- keep ownership outside the engine as configurable product policy
- or make it a first-class engine analysis layer

That choice affects the shape of stylesheet records and rule inputs.

### 5. How far should bounded render analysis go?

The render IR is already substantial, but it is still explicitly bounded.

Decision needed:

- what minimum JSX and helper coverage counts as product-ready
- whether helper expansion is a policy-driven plug-in point
- what unsupported render shapes should degrade to

### 6. What is the intended external CSS boundary?

Unclear points include:

- whether HTML extraction belongs in the engine
- whether remote fetching belongs in the engine
- whether declared global providers are engine policy or product policy

These should not be left implicit.

## Recommended Engine Direction

The engine should move toward one clean contract:

- build `ProjectAnalysis`
- build reusable indexes and match relations once
- keep rules thin
- stop exporting legacy comparison scaffolding as part of the main story

If we do that, the existing pipeline becomes an asset instead of a refactor trap.
