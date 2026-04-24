# Optimization And Migration Cutover Checklist

## Purpose

This document defines the family-specific cutover checklist for the shipped
`optimization-and-migration` rules during parity-first replacement onto the
`static-analysis-engine`.

It is the family-level companion to:

- `optimization-and-migration-parity-contract.md`
- `optimization-and-migration-divergence-review.md`
- `replacement-acceptance-criteria-checklist.md`
- `cutover-and-old-engine-retirement-checklist.md`

## Current Cutover Mode

Current reviewed mode:

- [x] four migrated rules are accepted as `adapter-backed`
- [x] `utility-class-replacement` is accepted as a first-release old-engine
  holdout
- [ ] the full family is approved for complete old-engine retirement

## Checklist

### 1. Contract And Documentation Lock

- [x] the family parity contract exists in
  `optimization-and-migration-parity-contract.md`
- [x] the family divergence review exists in
  `optimization-and-migration-divergence-review.md`
- [x] the family cutover mode is recorded in
  `rule-family-migration-matrix.md`
- [x] the family cutover status is recorded in
  `replacement-readiness-plan.md`
- [x] the first-wave decision for `utility-class-replacement` is explicit

### 2. Shipped Runtime Evidence

- [x] `duplicate-css-class-definition` is present in shipped output
- [x] `empty-css-rule` is present in shipped output
- [x] `redundant-css-declaration-block` is present in shipped output
- [x] `unused-compound-selector-branch` is present in shipped output
- [x] `utility-class-replacement` remains present in shipped output

Primary evidence:

- [x] `test/integration/optimization-and-migration.test.js`
- [x] `test/static-analysis-engine/feature/optimization-and-migration-cutover-readiness.test.js`

### 3. Comparison And Divergence Review

- [x] comparison evidence exists for the four migrated rules
- [x] the baseline-only status of `utility-class-replacement` is reviewed and
  classified
- [x] extra selector-level comparison signal for
  `unused-compound-selector-branch` is reviewed and classified
- [ ] the family no longer has any old-engine holdout

Primary evidence:

- [x] `test/static-analysis-engine/unit/comparison.test.js`
- [x] `test/static-analysis-engine/feature/optimization-and-migration-cutover-readiness.test.js`

### 4. Full Retirement Gate

- [ ] the project has made an explicit migration or defer-forever decision for
  `utility-class-replacement`
- [ ] the remaining optimization-family old-engine logic is no longer needed for
  shipped runtime behavior
- [ ] the project has explicitly approved retirement of the optimization-family
  old-engine holdout path

## Summary Decision

As of the current review:

- [x] this family is acceptable for first replacement release in its current
  mixed mode
- [ ] this family is ready for complete old-engine retirement
