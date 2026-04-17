# MVP Requirements

## Purpose

`react-css-scanner` should be a standalone npm tool for React projects that analyzes how React code uses CSS, reports code smells and rule violations, and can enforce policy thresholds in local workflows and CI.

The product goal is to behave more like a focused linter for React/CSS integration than a one-off project script.

## Core product shape

- ESM-only npm package
- CLI entrypoint for `npx`, package scripts, CI, and hooks
- Node API for programmatic use
- Shared analysis engine used by both CLI and API
- JSON-first configuration model
- Structured findings with rule IDs, severity, locations, and machine-readable metadata

## Primary workflows

- Run locally to inspect CSS usage problems.
- Run in CI and fail if findings at or above a configured policy threshold exist.
- Run in git hooks as a guardrail before code lands.
- Run from Node code to support custom workflows, reporting, or integrations.

## High-level analysis model

The scanner should build enough project knowledge to answer these questions:

- Which React modules import which CSS files?
- Which CSS files are reachable at runtime for a given React module?
- Which class names are referenced by React code?
- Which class names are defined in project CSS?
- Which class names come from external imported CSS?
- Which findings are high-confidence versus lower-confidence cases?

## Reachability model

The scanner should distinguish CSS by runtime reachability category:

- `local`: CSS imported by a specific module or its reachable implementation path
- `global`: CSS from configured global directories or configured global entrypoints
- `external`: CSS imported from third-party packages

This is important because "not directly imported by this exact file" is not always the same as "not available at runtime."

### Default ownership expectation

- By default, using a class that is not reachable for the React module at runtime should be reported as an error.
- Global CSS should be allowed anywhere once it is configured as global.
- When the scanner cannot determine reachability confidently, it should still be able to report a finding with lower confidence rather than silently guessing.

## Configuration

### Default format

- The default config file format should be JSON.

### Config discovery

- The scanner should look for config in the project root by default.
- The scanner should support configuring an alternate config location.
- The scanner should support a global config directory via an environment variable such as `REACT_CSS_SCANNER_CONFIG_DIR`.
- If no project-local config is found, and `REACT_CSS_SCANNER_CONFIG_DIR` is set, the scanner should check that location next.
- The scanner should support an explicit CLI/API config override such as `--config path/to/file.json`.
- The exact precedence rules should be documented clearly so configuration resolution is predictable.
- The scanner should load exactly one config source and should not merge multiple config files in MVP.
- If no config file is found, the scanner should fall back to built-in defaults and emit a terminal warning recommending that the user create a config file.

### Configuration responsibilities

Configuration should allow the consuming project to define:

- scan roots
- include and exclude paths
- global CSS directories
- CSS entrypoints considered globally reachable
- rule enablement
- severity overrides
- policy thresholds
- ignore patterns
- naming conventions
- ownership-related settings

### Configuration principles

- The scanner must not hardcode project structure from Loremaster.
- Configuration should be simple enough for JavaScript-first projects.
- Global CSS must be modeled separately from local CSS so ownership rules stay strict without over-reporting valid global usage.
- Source include/exclude values should be repo-relative globs.

## MVP support matrix

### In scope for the first release

- Straight static CSS imports
- CSS imported by parent or global CSS entrypoints
- Re-exported React components with local CSS
- Dynamic class composition with arrays
- Template literals and conditional expressions
- Variable indirection
- Class maps and lookup objects
- CSS Modules
- External CSS libraries and package imports
- Global selectors and non-class selectors

### Explicitly out of MVP

- Tailwind-specific or utility-framework-aware analysis
- Broad support for arbitrary class composition helper libraries beyond a small native set
- Full deep scanning of every CSS file in `node_modules`
- Autofix execution as a production feature

## Detailed MVP pattern expectations

### 1. Straight static CSS imports

Examples:

- `import "./Button.css"`
- `className="button buttonPrimary"`

Requirements:

- This should be a high-confidence path.
- The scanner should associate the importing module with the imported CSS.
- Missing-class and ownership checks should work reliably here.

### 2. CSS imported by parent or global CSS entrypoints

Examples:

- a route imports page CSS used by nested components
- an app entry imports global CSS

Requirements:

- The scanner must model runtime reachability, not just direct-file imports.
- Configured global CSS should be treated as accessible anywhere.
- MVP reachability should focus on direct CSS imports, configured global CSS, imported external CSS, and optionally configured app entry files.

### 3. Re-exported React components with local CSS

Examples:

- `index.ts` re-exports `Button`
- `Button.tsx` imports `Button.css`

Requirements:

- The scanner should analyze implementation modules rather than only public barrel files.
- Re-export patterns should not break ownership analysis.

### 4. Dynamic class composition with arrays

Examples:

- `className={[baseClass, isActive && "active"].filter(Boolean).join(" ")}`
- `const classes = ["card", variantClass].join(" ")`

Requirements:

- The scanner should extract statically knowable class tokens.
- Unknown dynamic values should not be guessed.
- Uncertain cases should remain analyzable as lower-confidence findings.

### 5. Template literals and conditional expressions

Examples:

- ``className={`button ${isPrimary ? "primary" : "secondary"}`}``
- `className={isOpen ? "open" : "closed"}`

Requirements:

- The scanner should enumerate obvious string-literal outcomes where practical.
- It should distinguish fully known branches from partly dynamic branches.

### 6. Helper libraries for class composition

Native MVP support should target the two mainstream helpers:

- `classnames`
- `clsx`

Requirements:

- The scanner should recognize common call patterns for these helpers.
- Unknown custom wrappers should not be treated as fully supported by default.
- Non-native helper patterns should fall back to conservative lower-confidence analysis where needed.

### 7. Variable indirection

Examples:

- `const buttonClass = "buttonPrimary"`
- `const className = isActive ? activeClass : baseClass`

Requirements:

- Simple local-variable indirection should be supported.
- The scanner should not attempt full general-purpose interprocedural data-flow analysis in MVP.

### 8. Class maps and lookup objects

Examples:

- `const variantClasses = { primary: "buttonPrimary", secondary: "buttonSecondary" }`
- `className={variantClasses[variant]}`

Requirements:

- Static object literals with known string values should be partially or fully analyzable.
- Unknown computed access should degrade gracefully to lower-confidence handling.

### 9. CSS Modules

Examples:

- `import styles from "./Button.module.css"`
- `className={styles.button}`
- `className={styles[variant]}`

Requirements:

- CSS Modules must not cause obvious false "missing CSS class" findings.
- The scanner should understand that classes may be accessed via module objects instead of raw strings.
- Dynamic property access on CSS Modules may require conservative handling.

### 10. External CSS libraries and package imports

Examples:

- `import "bootstrap/dist/css/bootstrap.css"`
- `import "@radix-ui/themes/styles.css"`

MVP interpretation:

- The scanner should index which external CSS packages are imported.
- It does not need to deeply scan every stylesheet in `node_modules`.
- Imported external CSS should be treated as reachable through an `external` category, similar to a global source of styles.
- Imported external CSS should be parsed for class definitions.

Requirements:

- If React code is in a subtree that can reach imported external CSS at runtime, the scanner should take that into account for ownership/access rules.
- External CSS awareness should help avoid false positives around missing imports or unreachable styles.
- Imported external CSS should contribute class definitions for validation.
- Unimported dependency CSS does not need to be scanned in MVP.

### 11. Global selectors and non-class selectors

Examples:

- tag selectors
- attribute selectors
- descendant selectors
- `:global(...)`

Requirements:

- The scanner should not assume all styling is represented as simple `.className` selectors.
- Some rules may stay class-focused, but the analysis model should tolerate broader selector forms.
- Broad selectors may reduce confidence for some findings.

## Rule system

### General rule model

- Rules must have stable IDs.
- Rules may optionally belong to rule families for readability and grouping in docs or output.
- Rules must be configurable.
- Rules must support enable/disable.
- Rules must support severity overrides.
- Rules must be extensible without rewriting the core scanner.

### MVP rule families

- missing CSS class definitions
- unreachable CSS usage
- unused CSS classes
- CSS ownership / locality violations
- global CSS that is only used in one place
- dynamic usage with lower confidence

### Severity and policy

- Findings must include a severity level.
- Policy thresholds must be configurable.
- The CLI must be able to exit non-zero when policy thresholds are breached.
- Confidence and severity must be treated as separate concepts.
- Findings should expose a confidence enum with values `low`, `medium`, or `high`.

## Node API requirements

- The package must expose structured scan results programmatically.
- The API must accept config and scan options.

## CLI requirements

- Accept a target path or use a sensible default.
- Support human-readable output.
- Support JSON output.
- Support policy-based non-zero exit codes.
- Be practical for local usage, scripts, CI, and hooks.

## Current implementation relevance

The legacy code remains useful as a source of ideas and partial logic, especially for:

- CSS rule parsing
- class extraction
- some dynamic class detection
- finding aggregation

However, the standalone product should not inherit:

- hardcoded Loremaster directory assumptions
- path-based ownership heuristics as the final model
- project-specific rules baked into source

## Open questions

- What exact JSON config schema should we standardize first?
- Which global/non-class-selector rule families belong in MVP versus later phases?
