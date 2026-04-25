# Current Product Assessment

## Purpose

This document assesses the product shell around the engine.

It focuses on:

- package and build state
- Node API and CLI state
- deleted functionality that now needs rebuilding around the engine
- product-level scope trims that are safe during the reboot
- ambiguities in intended product behavior

This document is intentionally separate from the engine assessment.

## Current State Summary

The product shell is currently broken.

The repo still describes a publishable package, but the package entrypoints point at deleted code:

- `src/index.ts` imports deleted config, runtime, facts, model, and rules modules
- `tsdown.config.ts` still expects `src/cli.ts`
- `package.json` still advertises a CLI binary and old test scripts
- `README.md` still describes deleted docs and deleted behavior as if the package were healthy

This is not a small bug. It means the product layer needs to be rebuilt rather than patched.

## Deleted Functionality That Must Be Rebuilt Around The Engine

These capabilities used to live in the product shell and still need real replacements.

### 1. Stable package entrypoint

Need to rebuild:

- root exports
- public Node API
- publishable types
- stable JSON contract

Target shape:

- `analyzeProject()` for prepared in-memory inputs
- `scanProject()` for real project scanning

### 2. CLI

Need to rebuild:

- argument parsing
- help text
- terminal output
- JSON output mode
- exit code behavior
- output file writing

The old CLI behavior should be treated as historical input, not as a strict implementation template.

### 3. Config

Need to rebuild:

- config file shape
- config validation
- default values
- config discovery
- config-source reporting

This is product logic, not engine logic.

### 4. Project discovery and file loading

Need to rebuild:

- scan root normalization
- source file discovery
- CSS file discovery
- HTML file discovery
- file reading
- ignore and exclude behavior

This should produce normalized inputs for `analyzeProject()`.

### 5. HTML stylesheet-link extraction

If external CSS support survives, the product shell needs to provide:

- HTML file parsing or extraction
- stylesheet link normalization
- feed into engine external CSS input

### 6. Reporting and summary building

Need to rebuild:

- finding collation
- summary counts
- severity filtering semantics
- human-readable report formatting
- deterministic JSON formatting

### 7. Policy and exit-code behavior

Need to rebuild:

- fail-on-severity policy
- distinction between findings and diagnostics
- JSON versus text output semantics

### 8. Tests

Need to rebuild:

- engine-level tests around normalized analysis contracts
- product integration tests around filesystem scanning
- CLI tests
- selected golden-output tests

### 9. Docs

Need to rebuild:

- API docs
- CLI docs
- config docs
- rule docs
- current project status docs

## Product Functionality That Is Safe To Trim During The Reboot

The reboot should intentionally keep scope small until the new contract settles.

### Safe trims

- shadow-mode comparison against the deleted scanner
- PATH-based config discovery
- `SCAN_REACT_CSS_CONFIG_DIR`
- `print-config`
- multiple verbosity tiers
- advanced output file collision behavior
- remote external CSS fetching
- ownership and organization rules
- migration-style rules and historical parity modes
- globally installed CLI polish beyond standard npm `bin`

### Candidate trims for v1

These depend on your appetite for scope, but they are reasonable to postpone:

- `focusPath`
- project-wide output filtering beyond simple severity filtering
- rich config override layering
- configurable rule families beyond on or off

## Product Ambiguities

These are the main unresolved product questions.

### 1. What is the minimum viable config?

Questions still open:

- do we want config discovery at all in the first reboot slice
- what defaults should be automatic versus explicit
- how much of the old config contract is still worth preserving

### 2. How much of the analysis should be exposed publicly?

Questions still open:

- should `scanProject()` optionally include raw analysis
- should `analyzeProject()` be public or internal
- how stable should the analysis JSON shape be

### 3. What counts as stable output?

Questions still open:

- are finding ids stable across versions
- is JSON a versioned contract
- do unsupported-analysis diagnostics belong in JSON by default

### 4. What is the first supported project shape?

Questions still open:

- single-package React app only
- monorepo with multiple source roots
- path aliases and tsconfig paths
- HTML entrypoints required or optional

### 5. What external CSS story do we really want?

Questions still open:

- imported external CSS only
- declared global providers
- remote fetching
- HTML-linked remote stylesheets

The reboot should choose a minimal v1 instead of carrying all historical possibilities.

### 6. Do we preserve old rule names?

If old rule identifiers are kept:

- we need a stable migration contract
- we need clear semantics for each rule

If not:

- we should rename around the new analysis model and version the contract cleanly

## Recommended Product Direction

The product shell should be rebuilt as a thin wrapper around the engine.

### Recommended first slice

1. Add a new root Node API with `analyzeProject()` and `scanProject()`.
2. Rebuild just enough config and discovery to scan a local project directory.
3. Emit deterministic JSON and a simple text report.
4. Reintroduce a minimal CLI.
5. Add tests for the new contract.

### Recommended principle

The product should not try to simulate the deleted scanner architecture.

Instead it should:

- load projects
- invoke normalized engine analysis
- run thin rules
- format stable results

That keeps the shell replaceable and lets the engine stay focused.
