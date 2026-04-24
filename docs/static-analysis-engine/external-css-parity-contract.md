# External CSS Parity Contract

## Purpose

This document defines the parity-first cutover contract for the shipped
`external-css` family on top of the `static-analysis-engine`.

It is the family-level companion to:

- `replacement-readiness-plan.md`
- `rule-family-migration-matrix.md`
- `external-css-divergence-review.md`
- `external-css-cutover-checklist.md`
- `replacement-acceptance-criteria-checklist.md`
- `cutover-and-old-engine-retirement-checklist.md`

Its job is to make the first replacement-release shape for this family explicit
enough to support ship/no-ship review.

## Scope

This contract covers the shipped rule:

- `missing-external-css-class`

It is intentionally about parity-first replacement of the shipped product
contract, not about redesigning external CSS semantics.

## Accepted First-Release Shape

The accepted first replacement shape for this family is:

- adapter-backed in the shipped runtime
- native-backed for imported external CSS detection, project-wide fetch-remote
  stylesheet activation, declared-provider activation, reachability, and rule
  execution
- runtime/current-scanner-owned for fetch-remote retrieval, failure fallback,
  and operational-warning shaping

Today that means:

- the shipped runtime routes `missing-external-css-class` through a bounded
  current-scanner adapter
- that adapter consumes native rule execution output plus current-scanner source
  reference facts to preserve finding shape details such as `column`,
  `referenceKind`, and reachable external stylesheet specifiers
- runtime-specific network behavior stays outside the rule adapter

This is an accepted first-wave cutover mode, not a temporary accident.

## Rule Contract

`missing-external-css-class` must report only when:

- a source file has imported or project-wide external CSS in play under the
  shipped contract
- no matching reachable external stylesheet definition is available
- no matching declared provider deliberately satisfies the token
- no reachable local project definition already explains the class

The rule must not regress by:

- losing directly imported external stylesheet satisfaction
- losing fetch-remote project-wide stylesheet satisfaction
- losing declared-provider suppression
- reclassifying a fetch failure into a different shipped rule instead of the
  existing warning-plus-`missing-external-css-class` contract
- dropping shipped finding-shape details such as source location or reachable
  external stylesheet specifiers without explicit review

## Blocking Regressions

For this family, the following count as blocking regressions for cutover review:

- imported external CSS no longer suppresses `missing-external-css-class` when
  the class exists
- declared-provider tokens regress into false `missing-external-css-class`
  findings
- fetch-remote project-wide stylesheet support regresses into false missing
  findings when the stylesheet is available
- fetch failure stops producing the shipped warning-plus-finding behavior
- the shipped runtime drops `missing-external-css-class` or silently routes it
  back to `missing-css-class`

## Accepted Temporary Gaps

The following are acceptable temporary gaps for the first replacement release:

- fetch-remote retrieval, failure fallback, and operational-warning shaping stay
  runtime-owned rather than engine-owned
- the shipped runtime still uses a bounded adapter instead of returning native
  rule results directly

These are acceptable only because they are explicit and reviewed.

## Required Evidence

The current evidence pack for this family should include:

- `test/unit/rules/external-css.test.js`
- `test/integration/external-css.test.js`
- `test/static-analysis-engine/unit/external-css.test.js`
- `test/static-analysis-engine/unit/rule-execution.test.js`
- `test/static-analysis-engine/unit/comparison.test.js`
- `test/static-analysis-engine/feature/replacement-readiness.test.js`
- `test/static-analysis-engine/feature/external-css-cutover-readiness.test.js`

## Cutover Decision For This Family

The current cutover decision is:

- accepted for the first replacement release as an adapter-backed shipped family
- not yet approved for retirement of the remaining runtime fetch/fallback
  boundary

This family becomes a retirement candidate for more of that boundary only when:

- runtime-specific fetch/fallback behavior has an explicit replacement or a
  deliberate long-term compatibility home
- the family divergence review and checklist remain satisfied
