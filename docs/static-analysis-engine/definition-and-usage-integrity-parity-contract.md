# Definition And Usage Integrity Parity Contract

## Purpose

This document defines the parity-first cutover contract for the shipped
`definition-and-usage-integrity` family on top of the
`static-analysis-engine`.

It is the family-level companion to:

- `replacement-readiness-plan.md`
- `rule-family-migration-matrix.md`
- `definition-and-usage-integrity-divergence-review.md`
- `definition-and-usage-integrity-cutover-checklist.md`
- `replacement-acceptance-criteria-checklist.md`
- `cutover-and-old-engine-retirement-checklist.md`

Its job is to make the first-release replacement shape explicit enough to
support a ship/no-ship review.

## Scope

This contract covers the shipped rules:

- `missing-css-class`
- `css-class-missing-in-some-contexts`
- `unreachable-css`
- `unused-css-class`

It is intentionally about parity-first replacement of the shipped product
contract, not about future rule redesign.

## Accepted First-Release Shape

The accepted first replacement shape for this family is:

- adapter-backed in the shipped runtime
- native-backed for direct/import/render/global/external reachability
  classification
- compatibility-backed for remaining parity-sensitive definition lookup and
  plain-class candidate policy

Today that means:

- the shipped runtime routes the full family through
  `adapters/current-scanner/runMigratedDefinitionAndUsageIntegrityRules.ts`
- the adapter rebuilds direct/import/render/global/external classification from
  native engine outputs
- the adapter still owns declared external-provider semantics, definition lookup
  shaping, and plain-class-versus-contextual/compound policy

This is an accepted first-wave cutover mode, not a failure to migrate.

## Rule Contract

### `missing-css-class`

The rule must report only when:

- React code references a class name
- no matching reachable definition is available under the shipped
  direct/import/render/global/external contract
- no declared provider or reachable remote external stylesheet deliberately
  satisfies that class under the shipped contract

The rule must not regress by:

- collapsing partial render-path coverage into `missing-css-class`
- losing direct-import or importer-ancestry satisfaction that already exists in
  the shipped contract
- regressing imported or project-wide external CSS suppression

### `css-class-missing-in-some-contexts`

The rule must report when:

- matching definitions exist
- no direct/import/render-definite path satisfies the class
- at least one known render path makes the class available

The rule must not regress by:

- collapsing partial-path availability into `unreachable-css`
- disappearing when the only support comes from some known render routes

### `unreachable-css`

The rule must report when:

- matching project definitions exist
- every candidate definition is unavailable from the referencing source file
  under the shipped direct/import/render/global/external contract

The rule must not regress by:

- swallowing true unreachable cases into `missing-css-class`
- firing when a direct-import ancestry path or partial render path is the real
  explanation
- silently over-crediting wrapper-owned CSS to descendant class usage when the
  shipped contract still treats that as unavailable

### `unused-css-class`

The rule must report only when:

- a plain project CSS class definition exists
- there is no convincing reachable React usage

For first-wave parity this means:

- direct, import-context, and render-context-definite usage suppresses the rule
- render-context-possible usage suppresses the rule
- partial-template candidate usage may suppress the rule under the shipped
  bounded matching policy
- contextual and compound selector-only evidence does not redefine the plain
  class contract

The rule must not regress by:

- losing const-backed composed usage
- losing bounded partial-template suppression when that policy is enabled
- changing the plain-class contract for contextual or compound selectors without
  an explicit product decision

## Blocking Regressions

For this family, the following count as blocking regressions for cutover review:

- `missing-css-class`, `css-class-missing-in-some-contexts`, and
  `unreachable-css` collapsing into one another
- direct-import ancestry or known partial render paths producing false missing or
  unreachable findings
- wrapper-owned CSS being reclassified as reachable for descendant class usage
  without an explicit product decision
- external CSS imports or declared providers regressing into false
  `missing-css-class` findings
- `unused-css-class` changing plain-class, contextual, compound, or
  partial-template behavior without an explicit written product decision
- nondeterministic class-level findings for the same inputs

## Accepted Temporary Gaps

The following are acceptable temporary gaps for the first replacement release:

- this family remains adapter-backed rather than fully native
- definition lookup and plain-class candidate policy remain compatibility-owned
- the native handoff is not approved until class-safe native rule inputs and a
  reviewed divergence log exist

These are acceptable only because the boundary is explicit and deliberate.

## Required Evidence

The current evidence pack for this family should include:

- `test/unit/rules/definition-and-usage-integrity.test.js`
- `test/integration/definition-and-usage-integrity.test.js`
- `test/static-analysis-engine/feature/definition-and-usage-integrity-cutover-readiness.test.js`

The cutover-readiness suite is specifically intended to keep the accepted
first-wave family contract visible at the shipped runtime boundary.

## Cutover Decision For This Family

The current cutover decision is:

- accepted for the first replacement release as an adapter-backed family
- not yet approved for full native adapter retirement

The adapter for this family becomes a retirement candidate only when:

- class-safe native rule inputs exist for the remaining parity-sensitive cases
- comparison and divergence review show no blocking regressions
- the replacement checklists are satisfied for this family
