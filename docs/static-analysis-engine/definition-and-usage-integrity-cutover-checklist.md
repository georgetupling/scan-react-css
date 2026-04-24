# Definition And Usage Integrity Cutover Checklist

## Purpose

This document defines the family-specific cutover checklist for the shipped
`definition-and-usage-integrity` rules during parity-first replacement onto the
`static-analysis-engine`.

It is the family-level companion to:

- `definition-and-usage-integrity-parity-contract.md`
- `definition-and-usage-integrity-divergence-review.md`
- `replacement-acceptance-criteria-checklist.md`
- `cutover-and-old-engine-retirement-checklist.md`

Its job is to make the release gate for this family explicit instead of leaving
it implied by the global checklists.

## Current Cutover Mode

Current reviewed mode:

- [x] first replacement release accepts this family as `adapter-backed`
- [ ] this family is approved for full native adapter retirement

Current boundary:

- [x] direct/import/render/global/external reachability classification is
  rebuilt from native engine outputs
- [x] definition lookup, declared-provider shaping, and plain-class candidate
  policy remain adapter-owned for parity

## Checklist

### 1. Contract And Documentation Lock

- [x] the family parity contract exists in
  `definition-and-usage-integrity-parity-contract.md`
- [x] the family divergence review exists in
  `definition-and-usage-integrity-divergence-review.md`
- [x] the family cutover mode is recorded in
  `rule-family-migration-matrix.md`
- [x] the family cutover status is recorded in
  `replacement-readiness-plan.md`
- [x] blocking regressions and accepted temporary gaps are written down

### 2. Shipped Runtime Evidence

- [x] missing versus unreachable findings are covered at the shipped runtime
  boundary
- [x] source-import ancestry satisfaction is covered
- [x] wrapper-owned CSS non-over-credit is covered
- [x] partial-path coverage is preserved as
  `css-class-missing-in-some-contexts`
- [x] plain-class and external CSS semantics are covered
- [x] partial-template `unused-css-class` suppression and fallback behavior are
  covered

Primary evidence:

- [x] `test/integration/definition-and-usage-integrity.test.js`
- [x] `test/static-analysis-engine/feature/definition-and-usage-integrity-cutover-readiness.test.js`

### 3. Comparison And Divergence Review

- [x] comparison evidence exists for possible selector support appearing before a
  shipped class-safe family mapping
- [x] comparison evidence exists for partial-path family findings remaining
  adapter-owned
- [x] comparison evidence exists for wrapper-owned CSS remaining unavailable to
  descendant usage in the shipped family contract
- [x] currently known divergences are classified in the family divergence review
- [ ] no reviewed divergence currently blocks full native adapter retirement

Primary evidence:

- [x] `test/static-analysis-engine/feature/replacement-readiness.test.js`
- [x] `test/static-analysis-engine/feature/definition-and-usage-integrity-shadow-divergence.test.js`

### 4. Native Retirement Gate

- [ ] class-safe native rule inputs exist for `missing-css-class`
- [ ] class-safe native rule inputs exist for
  `css-class-missing-in-some-contexts`
- [ ] class-safe native rule inputs exist for `unreachable-css`
- [ ] class-safe native rule inputs exist for `unused-css-class`
- [ ] possible, unknown, and unsupported selector outcomes have a reviewed
  mapping onto shipped family findings
- [ ] native inputs preserve the reviewed wrapper-owned CSS boundary
- [ ] native inputs preserve the shipped plain-class versus contextual/compound
  contract
- [ ] the project has explicitly approved retirement of
  `runMigratedDefinitionAndUsageIntegrityRules.ts`

## Summary Decision

As of the current review:

- [x] this family is acceptable for first replacement release as an
  adapter-backed shipped family
- [ ] this family is ready for native adapter retirement

That is the intended decision boundary: accept the current shipped replacement
path, but do not confuse that with approval to delete the compatibility seam.
