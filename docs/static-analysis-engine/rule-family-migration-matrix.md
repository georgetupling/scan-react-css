# Static Analysis Engine Rule-Family Migration Matrix

## Purpose

This document is the parity-first migration matrix for moving the shipped rule
catalog from the current scanner implementation onto the `static-analysis-engine`.

It is the companion to:

- `replacement-readiness-plan.md`
- `current-to-target-map.md`
- `docs/design/rules.md`

Its job is to answer:

- which shipped rules already have meaningful new-engine coverage
- which rules still need migration design
- which rules are likely to need compatibility adapters before full
  new-engine-native replacement
- what validation each rule family needs before cutover

## Scope

This matrix covers the current shipped rule families and rule IDs described in
`docs/design/rules.md`.

It does **not** cover:

- experimental-only new-engine rule IDs that are not part of the shipped
  product contract
- future rule-family redesign work
- speculative new rule ideas

## Decision Baseline

This matrix follows the project decision:

- parity-first with the current shipped rules and families
- redesign later, as separate work

That means the first question for each rule is:

- how do we replace the current shipped behavior?

not:

- how should the rule ideally be redesigned in a future product revision?

## Status Vocabulary

The statuses in this document mean:

- `experimental coverage exists`: the new engine already has a meaningful rule-
  level or comparison-level slice touching this area, but not yet parity
- `adapter-backed native slice landed`: the shipped runtime already serves this
  rule through a bounded current-scanner adapter backed by new-engine analysis
- `adapter seam landed`: the shipped runtime now routes the rule through a
  dedicated migration adapter, but parity-critical classification still
  intentionally relies on compatibility semantics while the native handoff is
  being validated
- `migration path visible`: the rule does not yet exist on the new engine, but
  the target owner and likely migration path are clear
- `needs migration design`: the target owner is broadly visible, but parity
  details or product semantics still need a written plan
- `likely compatibility adapter first`: a full new-engine-native rewrite may be
  unnecessary for first replacement; an adapter or staged coexistence path is
  probably the practical first move
- `blocked by capability gap`: replacement is not yet credible without more
  engine capability work

## Family Summary

| Family | Shipped rules | Current new-engine position | Close-out direction |
| --- | --- | --- | --- |
| `definition-and-usage-integrity` | `missing-css-class`, `css-class-missing-in-some-contexts`, `unreachable-css`, `unused-css-class` | A full current-scanner family adapter is now in for all four rules; direct/import/render/global/external reachability now comes from a native-backed adapter summary, while current definition lookup and plain-class candidate policy stay adapter-backed for parity | Keep the adapter path as the accepted first replacement shape documented in `definition-and-usage-integrity-parity-contract.md`, then decide when class-safe native rule inputs should replace the remaining parity helpers |
| `ownership-and-organization` | `component-style-cross-component`, `page-style-used-by-single-component`, `global-css-not-global`, `component-css-should-be-global` | No meaningful new-engine rule slice yet | Probably adapter-first, then selective native migration |
| `dynamic-analysis` | `dynamic-class-reference`, `dynamic-missing-css-class` | Engine has bounded value-flow support, but no shipped-rule migration yet | Needs migration design after parity contract is written |
| `css-modules` | `missing-css-module-class`, `unused-css-module-class` | No meaningful new-engine rule slice yet, and no first-class CSS-Module semantic layer is published yet | Likely compatibility adapter first, unless a native CSS-Module layer is added before cutover |
| `external-css` | `missing-external-css-class` | The shipped runtime now serves `missing-external-css-class` through a bounded adapter backed by native external CSS summary, native reachability, and native rule execution; runtime-specific fetch/fallback behavior stays outside that rule path | Keep the adapter-backed shipped path as the accepted first replacement shape documented in `external-css-parity-contract.md`, then decide when the remaining runtime fetch/fallback boundary can shrink further |
| `optimization-and-migration` | `utility-class-replacement`, `duplicate-css-class-definition`, `empty-css-rule`, `redundant-css-declaration-block`, `unused-compound-selector-branch` | First runtime-backed migration wave is in for four rules; `utility-class-replacement` still stays on the old engine | Best first family for parity-first migration |

## Rule Matrix

| Family | Rule ID | Current production owner | Target new-engine owner | Current status | Notes |
| --- | --- | --- | --- | --- | --- |
| `definition-and-usage-integrity` | `missing-css-class` | current scanner runtime via definition-and-usage migration adapter | `rule-execution` on top of `css-analysis`, `reachability`, `selector-analysis`, and class/value evidence | `adapter-backed native slice landed` | The shipped runtime now routes this rule through a family adapter that shares cached new-engine analysis setup, rebuilds direct/import/render/global/external reachability from native engine outputs, and keeps declared-provider semantics stable at the adapter boundary |
| `definition-and-usage-integrity` | `css-class-missing-in-some-contexts` | current scanner runtime via definition-and-usage migration adapter | `rule-execution` on top of `reachability` and selector/context evidence | `adapter-backed native slice landed` | The shipped runtime now routes this rule through the family adapter and classifies partial-path availability from the native-backed reachability summary rather than the old reachability helper, while still shaping findings to the shipped contract |
| `definition-and-usage-integrity` | `unreachable-css` | current scanner runtime via definition-and-usage migration adapter | `rule-execution` on top of `reachability` and CSS-definition evidence | `adapter-backed native slice landed` | The shipped runtime now routes this rule through the family adapter and derives its direct/import/render/global/external reachability status from native-backed adapter summaries instead of the old reachability helper |
| `definition-and-usage-integrity` | `unused-css-class` | current scanner runtime via definition-and-usage migration adapter | `rule-execution` on top of `css-analysis`, selector evidence, and bounded usage/reachability evidence | `adapter-backed native slice landed` | The shipped runtime now routes this rule through the same family adapter, reuses the native-backed reachability classifier for convincing usage checks, and keeps current plain-class versus contextual/partial-template policy stable through adapter-owned candidate matching |
| `ownership-and-organization` | `component-style-cross-component` | old rule engine on `ProjectModel` ownership model | `rule-execution` on top of ownership data plus new-engine reachability/render evidence | `likely compatibility adapter first` | The engine can strengthen evidence, but parity-first replacement does not require immediate redesign of ownership semantics |
| `ownership-and-organization` | `page-style-used-by-single-component` | old rule engine on `ProjectModel` ownership model | `rule-execution` on top of ownership data plus usage/reachability evidence | `likely compatibility adapter first` | Probably practical to preserve current ownership logic first, then decide later how much new-engine evidence should reshape the rule |
| `ownership-and-organization` | `global-css-not-global` | old rule engine on `ProjectModel` ownership model | `rule-execution` on top of ownership data plus usage/reachability evidence | `likely compatibility adapter first` | Parity-first replacement should avoid changing the ownership contract at the same time as engine cutover |
| `ownership-and-organization` | `component-css-should-be-global` | old rule engine on `ProjectModel` ownership model | `rule-execution` on top of ownership data plus usage/reachability evidence | `likely compatibility adapter first` | This rule already depends on thresholded product policy, so adapter-first is likely the safest initial replacement shape |
| `dynamic-analysis` | `dynamic-class-reference` | old rule engine on `ProjectModel` plus class-expression uncertainty | `rule-execution` on top of `abstract-values`, render/value uncertainty, and explicit unknown outcomes | `needs migration design` | The new engine has stronger bounded reasoning, so the parity question is product-facing: when should uncertainty still become a shipped dynamic finding? |
| `dynamic-analysis` | `dynamic-missing-css-class` | old rule engine on `ProjectModel` plus dynamic matching heuristics | `rule-execution` on top of `abstract-values`, CSS-definition evidence, and bounded unknown/possible outcomes | `needs migration design` | This likely needs explicit policy mapping so the new engine does not silently over-report or under-report dynamic missing cases |
| `css-modules` | `missing-css-module-class` | old CSS Modules rule engine path | likely `rule-execution` with dedicated CSS Module analysis inputs, or compatibility adapter | `likely compatibility adapter first` | The current new engine does not yet expose a first-class CSS-Module semantic layer comparable to the shipped implementation's import/property model |
| `css-modules` | `unused-css-module-class` | old CSS Modules rule engine path | likely `rule-execution` with dedicated CSS Module usage inputs, or compatibility adapter | `likely compatibility adapter first` | Same parity-first logic as above; do not block engine cutover on full CSS Modules redesign if an explicit adapter keeps the product contract stable, unless a native CSS-Module layer is added first |
| `external-css` | `missing-external-css-class` | current scanner runtime via external-css migration adapter | `rule-execution` on top of `external-css`, `reachability`, and bounded class/value evidence, with runtime fetch/fallback behavior adapter-backed in the first release | `adapter-backed native slice landed` | The shipped runtime now routes this rule through a bounded adapter that consumes native external CSS summary, native reachability, and native rule execution output while preserving shipped finding-shape details such as `column`, `referenceKind`, and reachable external stylesheet specifiers; the remaining first-release adapter boundary is runtime-specific fetch/fallback behavior rather than rule semantics |
| `optimization-and-migration` | `utility-class-replacement` | old optimization rule engine path | `rule-execution` on top of CSS-definition analysis and configured utility catalogs | `needs migration design` | The new engine can likely support this later, but it is not currently part of the experimental rule slice and may not need to be first-wave |
| `optimization-and-migration` | `duplicate-css-class-definition` | current scanner runtime via new-engine-backed adapter | `rule-execution` on top of `css-analysis` | `adapter-backed native slice landed` | The shipped runtime now serves this rule through a bounded adapter that consumes cached project facts, runs the new engine once per model, and maps the result back into the shipped finding shape |
| `optimization-and-migration` | `empty-css-rule` | current scanner runtime via new-engine-backed adapter | `rule-execution` on top of `css-analysis` | `adapter-backed native slice landed` | The shipped runtime now serves this rule through the same cached-fact adapter path, so stylesheet-only projects no longer depend on old rule-local CSS traversal for this finding |
| `optimization-and-migration` | `redundant-css-declaration-block` | current scanner runtime via new-engine-backed adapter | `rule-execution` on top of `css-analysis` | `adapter-backed native slice landed` | The current shipped runtime now consumes the new-engine CSS-analysis slice for this rule while preserving the shipped finding contract |
| `optimization-and-migration` | `unused-compound-selector-branch` | current scanner runtime via new-engine-backed adapter | `rule-execution` on top of `selector-analysis` and CSS-derived selector evidence | `adapter-backed native slice landed` | The current shipped runtime now consumes new-engine selector evidence for this rule through a bounded adapter, while still shaping findings to match the shipped runtime contract |

## Experimental-To-Shipped Mapping Notes

The current experimental new-engine rule IDs are **not** the shipped contract.

They currently serve two roles:

- proof that the engine can support rule execution
- comparison scaffolding for parity planning

Important examples:

- `duplicate-css-class-definition`, `empty-css-rule`,
  `redundant-css-declaration-block`, and `unused-compound-selector-branch`
  already overlap directly with shipped rules and now power the shipped runtime
  for the bounded optimization-family migration wave through a current-scanner
  adapter
- `missing-external-css-class` now also overlaps directly with a shipped rule
  and powers the shipped runtime through a bounded current-scanner adapter while
  runtime-specific fetch/fallback behavior stays outside the rule path
- `selector-never-satisfied`, `selector-possibly-satisfied`,
  `selector-analysis-unsupported`, and
  `contextual-selector-branch-never-satisfied` are useful migration signals, but
  they are not shipped rule IDs today

Those selector-derived experimental rules should be treated as:

- evidence and scaffolding for migrating shipped
  `definition-and-usage-integrity` behavior
- not as automatic additions to the shipped product contract

## Family-Level Validation Expectations

### `definition-and-usage-integrity`

Needed before cutover:

- keep `definition-and-usage-integrity-parity-contract.md` current as the
  accepted first-release family contract
- keep `definition-and-usage-integrity-divergence-review.md` current as the
  reviewed record for known comparison differences
- keep `definition-and-usage-integrity-cutover-checklist.md` current as the
  family release gate
- keep source-import ancestry and partial-path parity scenarios green on the
  adapter-routed shipped rules
- keep the native-backed direct/import/render/global/external classification
  aligned with those parity scenarios instead of letting route classification
  drift from shipped behavior
- direct-import ancestry scenarios
- explicit non-over-credit checks for wrapper-owned CSS
- partial-context reachability scenarios
- direct match, possible match, unknown barrier, and unavailable stylesheet cases
- partial-template and compound-versus-contextual plain-class evidence cases for
  `unused-css-class`
- comparison review against current scanner findings, including intentional
  divergences

Current validation note:

- `test/static-analysis-engine/feature/definition-and-usage-integrity-cutover-readiness.test.js`
  now serves as a focused shipped-runtime readiness suite for the accepted
  first-wave family contract
- `test/static-analysis-engine/feature/definition-and-usage-integrity-shadow-divergence.test.js`
  now serves as a focused comparison-side lock for the reviewed wrapper-owned
  CSS divergence

### `ownership-and-organization`

Needed before cutover:

- parity checks against existing ownership heuristics
- explicit decision on whether first replacement uses adapter-first semantics or
  immediate new-engine-native evidence

### `dynamic-analysis`

Needed before cutover:

- exact versus unresolved class-value scenarios
- imported helper and imported constant scenarios
- explicit mapping of bounded unknown outcomes into shipped dynamic findings

### `css-modules`

Needed before cutover:

- explicit decision on adapter-first versus native migration
- either a first-class CSS-Module semantic layer or a deliberate compatibility
  boundary
- stable parity checks for import resolution and unused-definition behavior

### `external-css`

Needed before cutover:

- keep `external-css-parity-contract.md` current as the accepted first-release
  family contract
- keep `external-css-divergence-review.md` current as the reviewed record for
  known family differences
- keep `external-css-cutover-checklist.md` current as the family release gate
- keep the native rule path for `missing-external-css-class`
- keep runtime-specific fetch-remote retrieval, failure fallback, and
  operational-warning shaping adapter-backed in the first replacement release
- parity checks for directly imported, declared-global/provider, and fetch-
  remote behavior
- explicit coverage for unavailable or fallback external stylesheet paths where
  the product contract still expects a deliberate finding or warning shape

Current validation note:

- `test/static-analysis-engine/feature/external-css-cutover-readiness.test.js`
  now serves as a focused shipped-runtime readiness suite for the accepted
  first-wave family contract

### `optimization-and-migration`

Needed before cutover:

- keep `optimization-and-migration-parity-contract.md` current as the accepted
  first-release family contract
- keep `optimization-and-migration-divergence-review.md` current as the reviewed
  record for known family differences
- keep `optimization-and-migration-cutover-checklist.md` current as the family
  release gate
- keep parity and comparison review current for the adapter-backed migrated
  rules
- separate migration decision for `utility-class-replacement`

Current validation note:

- `test/static-analysis-engine/feature/optimization-and-migration-cutover-readiness.test.js`
  now serves as a focused shipped-runtime and comparison-side readiness suite
  for the first-wave family shape

## Recommended Migration Order

The best parity-first order looks like this:

1. `optimization-and-migration`
2. `definition-and-usage-integrity`
3. `dynamic-analysis`
4. `ownership-and-organization`
5. `css-modules`
6. `external-css`

Why this order:

- the optimization family already has the strongest new-engine-native rule slice
- definition/usage integrity is where the engine’s structural advantages matter
  most
- dynamic-analysis is closely related to bounded value reasoning and should be
  planned after the main definition/usage contract
- ownership, CSS Modules, and external CSS are more likely to need adapter-
  first cutover decisions

## Concrete Next Steps

The next steps that follow directly from this matrix are:

1. use `replacement-acceptance-criteria-checklist.md` and
   `cutover-and-old-engine-retirement-checklist.md` to turn first-wave family
   decisions into explicit ship/no-ship gates
2. finish the divergence review and native handoff plan for the
    `definition-and-usage-integrity` adapter seam, building on the now-landed
    `definition-and-usage-integrity-parity-contract.md`,
    `definition-and-usage-integrity-divergence-review.md`, and
    `definition-and-usage-integrity-cutover-checklist.md`, especially:
   - how class-level `possible` and `unknown` engine outcomes map to shipped
     findings
   - which reachability inputs are safe enough to replace the compatibility
     classifier
   - how contextual selector evidence should and should not satisfy plain class
     checks
3. decide explicitly which remaining families are adapter-first for initial
   replacement:
   - likely `ownership-and-organization`
   - likely `css-modules`
   - `external-css` now has a written first-release adapter decision and should
     stay current rather than implicit
4. add targeted per-family cutover checklists where the global checklists are
   still too broad, continuing past the now-landed
   `definition-and-usage-integrity` and `optimization-and-migration` families
5. extend replacement validation so comparison is organized around these family
   decisions rather than only around isolated exploratory scenarios
6. keep the now-landed optimization-family parity contract, divergence review,
   and cutover checklist current so the project can decide when that family
   counts as fully migrated rather than only adapter-backed

## Open Questions

These are not blocking ambiguities for this matrix, but they do require later
 decisions:

- whether `utility-class-replacement` belongs in the first parity wave or a
  later optimization follow-on
- whether ownership-family rules should remain adapter-backed for the entire
  first cutover
- whether CSS Modules should stay on compatibility adapters through the first
  replacement release instead of waiting for a native CSS-Module semantic layer

## Summary

This matrix makes the current state explicit:

- the new engine is strongest today in the
  `optimization-and-migration` family
- four optimization-family rules now already run through a bounded
  new-engine-backed adapter in the shipped runtime
- the most important parity-first migration family remains
  `definition-and-usage-integrity`, and it now has a landed adapter seam for
  three shipped rules
- ownership and CSS Modules are still the strongest compatibility-first
  candidates, while external CSS now has a meaningful native path that still
  needs explicit cutover validation

That gives the project a concrete path to replacement without mixing it with a
future rule/family redesign effort.
