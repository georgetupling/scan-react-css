# External CSS Divergence Review

## Purpose

This document is the reviewed divergence record for the shipped `external-css`
family during parity-first replacement onto the `static-analysis-engine`.

It is the family-level companion to:

- `external-css-parity-contract.md`
- `external-css-cutover-checklist.md`
- `replacement-readiness-plan.md`
- `rule-family-migration-matrix.md`

## Current Review Decision

The current reviewed decision for this family is:

- the shipped rule path is acceptable as an adapter-backed native slice
- the remaining deliberate boundary is runtime-specific fetch-remote retrieval,
  failure fallback, and operational-warning shaping

## Reviewed Differences

### 1. Fetch-remote retrieval and warning shaping remain runtime-owned

Observed behavior:

- the native rule path consumes fetched external stylesheet texts and normalized
  provider/html inputs
- the actual remote fetch attempt, fetch failure handling, and operational
  warning text still live in the current scanner/runtime layer

Current classification:

- `acceptable temporary gap`

Why that classification is accepted:

- the shipped rule semantics are already served through the native-backed
  adapter path
- the remaining non-native behavior is operational/runtime policy, not class
  matching or reachability semantics

Evidence:

- `test/integration/external-css.test.js`
- `test/static-analysis-engine/feature/external-css-cutover-readiness.test.js`

## Non-Divergence Evidence Already Locked

Current evidence already shows that:

- imported external CSS suppresses `missing-external-css-class` when the class
  exists
- active declared providers suppress provider-owned tokens
- fetch-remote project-wide external stylesheets satisfy reachable external
  classes when the stylesheet is available
- shadow comparison can match the native `missing-external-css-class` rule slice
  against the shipped scanner

Primary evidence:

- `test/unit/rules/external-css.test.js`
- `test/integration/external-css.test.js`
- `test/static-analysis-engine/unit/comparison.test.js`
- `test/static-analysis-engine/feature/external-css-cutover-readiness.test.js`

## What Counts As Blocking From Here

For future review, the following would count as `blocking regression`:

- any candidate that reintroduces false `missing-external-css-class` findings
  for declared-provider or imported-external tokens
- any candidate that regresses fetch-remote project-wide stylesheet support
- any candidate that changes the shipped warning-plus-finding fallback contract
  for unavailable remote stylesheets without explicit product review

## Next Review Trigger

This review should be updated when either of these becomes true:

- the project proposes moving fetch-remote retrieval or warning shaping out of
  the current scanner/runtime boundary
- the project proposes removing the bounded current-scanner adapter around the
  shipped external-css rule path
