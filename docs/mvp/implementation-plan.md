# Implementation Plan

## Purpose

This document turns the MVP design docs into a practical implementation sequence.

It is intended to answer:

- what we should build first
- what each phase is responsible for
- what is explicitly out of scope for each phase
- what “done” means before moving on

This is a high-level plan for Codex-friendly implementation, not a ticket tracker.

## Planning principles

- Build the foundation before building many rules.
- Keep each phase end-to-end enough to be testable.
- Prefer one clear vertical slice at a time over broad partial implementation.
- Lock runtime contracts and config behavior early so later work does not thrash.

## Phase 1: Config Foundation

### Goal

Implement config loading, discovery, validation, normalization, and runtime access.

### Scope

- config discovery order
- config file reading
- single-source config resolution
- fallback to built-in defaults
- warning when defaults are used because no config file was found
- normalization into `ResolvedReactCssScannerConfig`
- validation of known enums and numeric thresholds

### Inputs

- [config-schema.md](./config-schema.md)
- [config-contract.md](./config-contract.md)
- [runtime-contracts.md](./runtime-contracts.md)
- [src/config/types.ts](/c:/Users/georg/Desktop/react-css-scanner/src/config/types.ts)

### Out of scope

- full CLI scanning behavior
- rule execution
- file graph construction

### Done criteria

- config is discoverable from the documented sources
- exactly one config source is loaded
- invalid config fails clearly
- resolved config matches `ResolvedReactCssScannerConfig`
- automated tests cover precedence and fallback behavior

## Phase 2: File Discovery and Parsing Facts

### Goal

Implement discovery of source and CSS files and extract raw facts without cross-file reasoning.

### Scope

- collect source files from configured include/exclude globs
- collect project CSS files
- detect imported external CSS files
- parse source imports
- parse CSS imports
- extract class references
- extract CSS class definitions
- recognize CSS Modules
- recognize `classnames` and `clsx`

### Inputs

- [architecture.md](./architecture.md)
- [requirements.md](./requirements.md)

### Out of scope

- ownership classification beyond local fact extraction
- reachability analysis
- rule evaluation

### Done criteria

- each scanned file produces deterministic fact output
- external CSS imports are discovered and resolved
- CSS Modules and helper-library references are recognized at fact level
- model tests cover key parsing scenarios

## Phase 3: Project Model and Ownership Classification

### Goal

Build the normalized project model and classify CSS by reachability and ownership.

### Scope

- graph construction
- derived indexes
- ownership classification:
  - `component`
  - `page`
  - `global`
  - `utility`
  - `external`
  - `unclassified`
- ownership classification using:
  - `css.global`
  - `css.utilities`
  - `ownership.pagePatterns`
  - `ownership.componentCssPatterns`
  - `ownership.namingConvention`

### Inputs

- [architecture.md](./architecture.md)
- [config-schema.md](./config-schema.md)

### Out of scope

- full rule execution
- CLI formatting

### Done criteria

- project graph is built from extracted facts
- derived indexes are queryable
- ownership classification is deterministic and documented in code
- ambiguous files can remain `unclassified`

## Phase 4: Reachability Engine

### Goal

Implement the MVP CSS reachability model.

### Scope

- direct CSS imports
- configured global CSS
- imported external CSS
- optionally configured app entry files if needed by the implementation approach
- per-source-file `ReachabilityInfo`

### Inputs

- [architecture.md](./architecture.md)
- [requirements.md](./requirements.md)

### Out of scope

- post-MVP render-tree heuristics
- transitive dependency CSS beyond imported files

### Done criteria

- reachability can be queried per source file
- imported external CSS contributes reachable class definitions
- non-reachable CSS is excluded from reachability-sensitive rule checks
- model tests cover local/global/external behavior

## Phase 5: Core Findings Model and Rule Engine

### Goal

Implement the normalized finding model and the rule execution framework.

### Scope

- finding runtime shape
- severity and confidence handling
- rule registration/execution model
- family metadata
- deterministic ordering

### Inputs

- [runtime-contracts.md](./runtime-contracts.md)
- [mvp-rules.md](./mvp-rules.md)

### Out of scope

- full human-readable reporting polish
- all stretch rules

### Done criteria

- rules can run against the project model without re-reading files
- findings match the runtime contract
- ordering is deterministic
- severity and confidence are separate at runtime

## Phase 6: Tier 1 MVP Rules

### Goal

Implement the locked Tier 1 MVP rule set.

### Tier 1 rules

- `missing-css-class`
- `unreachable-css`
- `unused-css-class`
- `component-style-cross-component`
- `global-css-not-global`
- `utility-class-replacement`
- `dynamic-class-reference`
- `missing-css-module-class`

### Inputs

- [mvp-rules.md](./mvp-rules.md)

### Out of scope

- Tier 2 stretch rules
- post-MVP rules

### Done criteria

- each Tier 1 rule produces findings with the expected rule ID
- default severities match the rule doc
- rules use documented config where required
- integration tests cover at least one positive and one negative case per rule

## Phase 7: CLI and JSON Reporting

### Goal

Implement the MVP CLI behavior and reporting contracts.

### Scope

- target path input
- `--config`
- `--json`
- `--output-file`
- `--overwrite-output`
- `--output-min-severity`
- `--config-summary`
- `--output-mode`
- exit-code behavior
- default config warning

### Inputs

- [runtime-contracts.md](./runtime-contracts.md)

### Out of scope

- advanced CLI customization beyond documented modes

### Done criteria

- CLI behavior matches runtime contract
- invalid flag combinations fail early
- JSON output is deterministic
- human-readable output groups by CSS class by default

## Phase 8: Integration Test Harness

### Goal

Build the test project builder and the first realistic integration scenarios.

### Scope

- baseline templates
- file-oriented `TestProjectBuilder`
- resource-file loading helpers
- integration tests for:
  - config resolution
  - local CSS
  - global CSS
  - external CSS
  - CSS Modules
  - dynamic references
  - Tier 1 rules

### Inputs

- [testing-plan.md](./testing-plan.md)

### Out of scope

- broad fixture library
- performance regression gates

### Done criteria

- generated test projects are deterministic
- core integration scenarios pass
- builder API is simple enough for future scenario expansion

## Phase 9: Tier 2 and Performance

### Goal

Add good stretch rules and introduce basic performance visibility.

### Scope

- Tier 2 rules:
  - `page-style-used-by-single-component`
  - `dynamic-missing-css-class`
  - `unused-css-module-class`
  - `missing-external-css-class`
  - `duplicate-css-class-definition`
  - `component-css-should-be-global`
- basic benchmark coverage
- stage timing hooks if practical

### Out of scope

- post-MVP heuristics
- safe autofix
- broader framework-aware behavior

### Done criteria

- Tier 2 rule behavior is covered by tests
- benchmark suite exists
- obvious performance regressions are measurable

## Suggested execution order

Recommended order:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 8
9. Phase 9

## Stop points

The best MVP-ready stop points are:

- after Phase 6 if the API/model is the immediate priority
- after Phase 7 if the CLI contract is the immediate priority
- after Phase 8 if the goal is a trustworthy first external release candidate

## Design summary

This plan intentionally sequences work as:

- config
- parsing
- model
- reachability
- rules
- reporting
- tests
- performance

That order should minimize rework and keep the implementation aligned with the MVP docs.
