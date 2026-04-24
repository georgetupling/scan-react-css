# Optimization And Migration Parity Contract

## Purpose

This document defines the parity-first cutover contract for the shipped
`optimization-and-migration` family on top of the `static-analysis-engine`.

It is the family-level companion to:

- `replacement-readiness-plan.md`
- `rule-family-migration-matrix.md`
- `optimization-and-migration-divergence-review.md`
- `optimization-and-migration-cutover-checklist.md`
- `replacement-acceptance-criteria-checklist.md`
- `cutover-and-old-engine-retirement-checklist.md`

Its job is to make the first replacement-release shape for this family explicit
enough to support a ship/no-ship review.

## Scope

This contract covers the shipped rules:

- `utility-class-replacement`
- `duplicate-css-class-definition`
- `empty-css-rule`
- `redundant-css-declaration-block`
- `unused-compound-selector-branch`

It is intentionally about parity-first replacement of the current shipped family
contract, not about redesigning the optimization catalog.

## Accepted First-Release Shape

The accepted first replacement shape for this family is:

- adapter-backed in the shipped runtime for four migrated rules:
  `duplicate-css-class-definition`, `empty-css-rule`,
  `redundant-css-declaration-block`, and `unused-compound-selector-branch`
- old-engine-backed for `utility-class-replacement` in the first replacement
  release

Today that means:

- the shipped runtime routes the four migrated rules through
  `adapters/current-scanner/runMigratedOptimizationRules.ts`
- those migrated rules already consume native rule execution outputs and are
  mapped back into the shipped finding contract through that adapter
- `utility-class-replacement` remains intentionally on the current scanner path
  until the project makes a separate first-wave decision for that rule

This mixed first-wave shape is accepted for cutover review as long as it stays
explicit.

## Rule Contract

### `duplicate-css-class-definition`

The rule must continue to report only for repeated plain project class
definitions that remain duplicates under the shipped selector and at-rule
contract.

It must not regress by:

- grouping compound, attribute, or otherwise non-equivalent selector variants
- grouping definitions that differ only by at-rule context

### `empty-css-rule`

The rule must continue to report selector blocks with no declarations while
preserving selector text and at-rule context in the shipped finding shape.

### `redundant-css-declaration-block`

The rule must continue to report only repeated declaration blocks in the same
selector and at-rule context.

It must not regress by:

- treating breakpoint or selector-context differences as redundant duplicates
- dropping duplicate location metadata from the shipped finding shape

### `unused-compound-selector-branch`

The rule must continue to report when React never emits the full required class
set together under the shipped direct/import/render-context evidence contract.

It must not regress by:

- ignoring same-node co-usage that already satisfies the compound branch
- ignoring render-context evidence that can supply the full compound class set
- leaking CSS Module files into the shipped migrated path

### `utility-class-replacement`

For the first replacement release, this rule remains on the current scanner.

That means the contract is:

- the rule still exists in shipped output for the first replacement release
- its current behavior is preserved through the old-engine path until the
  project makes an explicit migration decision

## Blocking Regressions

For this family, the following count as blocking regressions for cutover review:

- any of the four migrated rules disappearing from shipped output
- the migrated rules changing selector or at-rule sensitivity without explicit
  review
- `unused-compound-selector-branch` losing render-context suppression that
  already exists in the shipped contract
- `utility-class-replacement` being dropped silently before an explicit
  migration or defer decision is recorded

## Accepted Temporary Gaps

The following are acceptable temporary gaps for the first replacement release:

- `utility-class-replacement` remains on the old engine
- the comparison harness may still show extra experimental selector signals
  alongside `unused-compound-selector-branch`
- the four migrated rules remain adapter-backed rather than bypassing the
  current-scanner finding layer entirely

These are acceptable only because they are explicit and reviewed.

## Required Evidence

The current evidence pack for this family should include:

- `test/unit/rules/optimization-and-migration.test.js`
- `test/integration/optimization-and-migration.test.js`
- `test/static-analysis-engine/unit/rule-execution.test.js`
- `test/static-analysis-engine/unit/comparison.test.js`
- `test/static-analysis-engine/feature/optimization-and-migration-cutover-readiness.test.js`

## Cutover Decision For This Family

The current cutover decision is:

- accepted for the first replacement release as a mixed family:
  four adapter-backed migrated rules plus one deliberate old-engine holdout
- not yet approved for full family-native retirement of all old-engine logic

The remaining old-engine family surface becomes a retirement candidate only
when:

- the project makes an explicit first-wave decision for
  `utility-class-replacement`
- the family checklist and divergence review stay satisfied
