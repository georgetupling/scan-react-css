# External CSS Cutover Checklist

## Purpose

This document defines the family-specific cutover checklist for the shipped
`external-css` rules during parity-first replacement onto the
`static-analysis-engine`.

It is the family-level companion to:

- `external-css-parity-contract.md`
- `external-css-divergence-review.md`
- `replacement-acceptance-criteria-checklist.md`
- `cutover-and-old-engine-retirement-checklist.md`

## Current Cutover Mode

Current reviewed mode:

- [x] `missing-external-css-class` is accepted as an `adapter-backed` shipped
  rule
- [ ] runtime-specific fetch/fallback behavior is approved for retirement from
  the current scanner/runtime boundary

## Checklist

### 1. Contract And Documentation Lock

- [x] the family parity contract exists in `external-css-parity-contract.md`
- [x] the family divergence review exists in
  `external-css-divergence-review.md`
- [x] the family cutover mode is recorded in
  `rule-family-migration-matrix.md`
- [x] the family cutover status is recorded in
  `replacement-readiness-plan.md`
- [x] the runtime-specific fetch/fallback boundary is written down explicitly

### 2. Shipped Runtime Evidence

- [x] imported external CSS behavior is covered on the shipped path
- [x] declared-global/provider suppression is covered on the shipped path
- [x] fetch-remote project-wide external stylesheet behavior is covered on the
  shipped path
- [x] unavailable remote stylesheet fallback behavior is covered on the shipped
  path
- [x] shipped finding-shape details such as source location and external
  stylesheet specifiers remain preserved

Primary evidence:

- [x] `test/unit/rules/external-css.test.js`
- [x] `test/integration/external-css.test.js`
- [x] `test/static-analysis-engine/feature/external-css-cutover-readiness.test.js`

### 3. Comparison And Divergence Review

- [x] comparison evidence exists for the native `missing-external-css-class`
  rule slice
- [x] the remaining runtime-owned fetch/fallback boundary is reviewed and
  classified
- [x] there is no current reviewed rule-semantic divergence blocking the
  adapter-backed shipped path

Primary evidence:

- [x] `test/static-analysis-engine/unit/comparison.test.js`
- [x] `test/static-analysis-engine/feature/replacement-readiness.test.js`
- [x] `test/static-analysis-engine/feature/external-css-cutover-readiness.test.js`

### 4. Full Retirement Gate

- [ ] the project has an explicit long-term home for fetch-remote retrieval and
  warning shaping
- [ ] the remaining runtime-specific external CSS boundary is no longer required
  for shipped behavior
- [ ] the project has explicitly approved retirement of the remaining
  current-scanner/runtime-owned external CSS boundary

## Summary Decision

As of the current review:

- [x] this family is acceptable for first replacement release as an
  adapter-backed shipped family
- [ ] this family is ready for retirement of the remaining runtime-owned
  fetch/fallback boundary
