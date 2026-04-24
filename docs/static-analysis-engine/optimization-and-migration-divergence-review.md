# Optimization And Migration Divergence Review

## Purpose

This document is the reviewed divergence record for the shipped
`optimization-and-migration` family during parity-first replacement onto the
`static-analysis-engine`.

It is the family-level companion to:

- `optimization-and-migration-parity-contract.md`
- `optimization-and-migration-cutover-checklist.md`
- `replacement-readiness-plan.md`
- `rule-family-migration-matrix.md`

## Current Review Decision

The current reviewed decision for this family is:

- the four migrated rules are acceptable for adapter-backed cutover
- `utility-class-replacement` remains a deliberate old-engine holdout in the
  first replacement release

## Reviewed Differences

### 1. `utility-class-replacement` is baseline-only by design in the first wave

Observed behavior:

- the shipped runtime still reports `utility-class-replacement`
- the comparison path for the new engine does not yet emit a native counterpart

Current classification:

- `acceptable temporary gap`

Why that classification is accepted:

- the rule is not silently lost
- the first-wave family decision is explicit: keep this rule on the current
  scanner until a separate migration decision exists

Evidence:

- `test/integration/optimization-and-migration.test.js`
- `test/static-analysis-engine/feature/optimization-and-migration-cutover-readiness.test.js`

### 2. `unused-compound-selector-branch` can have extra selector-level comparison signal

Observed behavior:

- shadow comparison can match the shipped `unused-compound-selector-branch`
  finding
- the same comparison can also surface selector-level experimental signal such
  as `selector-never-satisfied`

Current classification:

- `expected improvement` while those extra signals remain comparison-only and do
  not alter the shipped rule catalog

Why that classification is accepted:

- the shipped family finding still matches
- the extra signal is additional explanation, not a product regression

Evidence:

- `test/static-analysis-engine/unit/comparison.test.js`
- `test/static-analysis-engine/feature/optimization-and-migration-cutover-readiness.test.js`

## Non-Divergence Evidence Already Locked

Current evidence already shows that:

- `duplicate-css-class-definition`, `empty-css-rule`,
  `redundant-css-declaration-block`, and `unused-compound-selector-branch`
  have a real new-engine-backed shipped runtime path
- comparison can match those four migrated rule IDs against the shipped scanner

Primary evidence:

- `test/static-analysis-engine/unit/comparison.test.js`
- `test/static-analysis-engine/feature/optimization-and-migration-cutover-readiness.test.js`

## What Counts As Blocking From Here

For future review, the following would count as `blocking regression`:

- losing a shipped match for any of the four migrated rules without explicit
  review
- dropping `utility-class-replacement` before a written first-wave decision
- changing selector or at-rule sensitivity for the migrated rules without
  deliberate product review

## Next Review Trigger

This review should be updated when either of these becomes true:

- the project proposes migrating `utility-class-replacement`
- the project proposes retiring the optimization-family adapter layer entirely
