# Definition And Usage Integrity Divergence Review

## Purpose

This document is the reviewed divergence record for the shipped
`definition-and-usage-integrity` family during parity-first replacement onto the
`static-analysis-engine`.

It is the family-level companion to:

- `definition-and-usage-integrity-parity-contract.md`
- `definition-and-usage-integrity-cutover-checklist.md`
- `replacement-readiness-plan.md`
- `rule-family-migration-matrix.md`

Its job is to keep known comparison differences classified and reviewed instead
of letting them remain implicit.

## Scope

This review covers the shipped rules:

- `missing-css-class`
- `css-class-missing-in-some-contexts`
- `unreachable-css`
- `unused-css-class`

It is about cutover review for the current shipped product contract, not about
future redesign of selector or class semantics.

## Current Review Decision

The current reviewed decision for this family is:

- accepted for first replacement release as an adapter-backed shipped family
- not approved for full native adapter retirement

Why:

- the shipped runtime now has a bounded adapter seam with native-backed
  direct/import/render/global/external reachability classification
- comparison evidence still shows native experimental selector outputs that do
  not yet map safely onto the shipped family's class-level findings

That makes the current divergences acceptable for adapter-backed cutover, but
not acceptable to ignore when considering retirement of
`runMigratedDefinitionAndUsageIntegrityRules.ts`.

## Reviewed Divergences

### 1. Possible selector support is visible natively before it is safe as a shipped family finding

Observed behavior:

- native comparison can emit `selector-possibly-satisfied`
- the shipped scanner still reports `missing-css-class` in the equivalent
  user-facing scenario

Current classification:

- `acceptable temporary gap` for first replacement release

Why that classification is accepted:

- the native result is currently a selector-level signal, not a class-safe
  shipped family decision
- the shipped runtime still routes the family through the adapter seam, so users
  keep the current rule IDs and findings

Evidence:

- `test/static-analysis-engine/feature/replacement-readiness.test.js`
- especially the conditional-composition comparison scenario already reviewed in
  that suite

Retirement implication:

- this divergence blocks adapter retirement until possible/unknown selector
  outcomes have a reviewed mapping onto shipped class findings

### 2. Partial render-path availability is still adapter-owned at the shipped rule boundary

Observed behavior:

- native comparison evidence can show selector or reachability support for only
  some paths
- the shipped runtime still owns the class-level output decision and reports
  `css-class-missing-in-some-contexts`

Current classification:

- `acceptable temporary gap` for first replacement release

Why that classification is accepted:

- the adapter-backed shipped path preserves the user-facing family contract
- the new engine already contributes route classification, but the final
  class-level rule mapping is still intentionally compatibility-shaped

Evidence:

- `test/static-analysis-engine/feature/replacement-readiness.test.js`
- `test/static-analysis-engine/feature/definition-and-usage-integrity-cutover-readiness.test.js`

Retirement implication:

- native retirement is blocked until partial-path evidence has a class-safe
  mapping that preserves the distinction between
  `css-class-missing-in-some-contexts`, `missing-css-class`, and
  `unreachable-css`

### 3. Wrapper-owned CSS is not automatically credited to descendant class usage in the shipped family contract

Observed behavior:

- when `App` imports `Page.css`, a wrapper component imports `Field.css`, and a
  leaf component references both `page-shell` and `field__hint`, the shipped
  runtime treats `page-shell` as reachable through importer ancestry
- the same shipped runtime still reports `field__hint` as
  `unreachable-css` and `unused-css-class`
- the native comparison pilot currently records selector-level unsupported
  signals rather than producing those shipped family findings directly

Current classification:

- `acceptable temporary gap` for first replacement release

Why that classification is accepted:

- the shipped family contract is preserved by the adapter-backed runtime
- the reviewed boundary is explicit: importer ancestry counts, but wrapper-owned
  CSS is not silently over-credited to descendant usage

Evidence:

- `test/static-analysis-engine/feature/definition-and-usage-integrity-cutover-readiness.test.js`
- `test/static-analysis-engine/feature/definition-and-usage-integrity-shadow-divergence.test.js`

Retirement implication:

- this remains a `blocking regression` risk for native adapter retirement until
  native rule inputs can reproduce this boundary deliberately instead of
  collapsing it into unsupported or over-credited outcomes

## Non-Divergence Evidence Already Locked

The following are already locked as part of the accepted first-wave contract:

- `missing-css-class` versus `unreachable-css` remains distinct at the shipped
  runtime boundary
- partial-path coverage is preserved as
  `css-class-missing-in-some-contexts`, not collapsed into
  `missing-css-class` or `unreachable-css`
- imported external CSS and declared-provider suppression remain stable at the
  shipped runtime boundary
- bounded partial-template suppression for `unused-css-class` remains stable

Current evidence for those non-divergence claims lives in:

- `test/integration/definition-and-usage-integrity.test.js`
- `test/static-analysis-engine/feature/definition-and-usage-integrity-cutover-readiness.test.js`

## What Counts As Blocking From Here

For future review, the following would count as `blocking regression` for this
family:

- any native handoff candidate that collapses `missing-css-class`,
  `css-class-missing-in-some-contexts`, and `unreachable-css`
- any candidate that reclassifies wrapper-owned CSS as reachable for descendant
  usage without an explicit product decision
- any candidate that changes plain-class versus contextual or compound policy
  for `unused-css-class` without explicit review
- any candidate that removes current external-provider or external-import
  suppression behavior from the shipped runtime path

## Next Review Trigger

This review should be updated when either of these becomes true:

- a class-safe native rule input or native family implementation is proposed for
  retiring `runMigratedDefinitionAndUsageIntegrityRules.ts`
- comparison tooling gains a reviewed mapping from possible/unknown/unsupported
  selector outcomes to shipped family findings

Until then, this document records why the family is accepted for adapter-backed
cutover but not yet for native adapter retirement.
