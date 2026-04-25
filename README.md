# scan-react-css

`scan-react-css` audits how React source code uses CSS.

It scans React source files, project CSS, and CSS Modules, then reports deterministic findings for local development and CI. The current package is the rebooted product shell around the static analysis engine in `src/static-analysis-engine`.

## Current Status

The active public contract is documented in:

- [Reboot Contract](./docs/design/reboot-contract.md)
- [Rules Catalogue](./docs/design/rules-catalogue.md)
- [CSS Modules Contract](./docs/design/css-modules-contract.md)
- [Current Product Assessment](./docs/design/current-product-assessment.md)

Some historical scanner features are being reintroduced deliberately. Unsupported historical flags fail fast instead of being ignored.

## Install

```bash
npm install --save-dev scan-react-css
```

Node `20+` is required.

For one-off runs:

```bash
npx scan-react-css
```

## Quick Start

Scan the current directory:

```bash
npx scan-react-css
```

Scan a specific project root:

```bash
npx scan-react-css ./packages/web
```

Focus reported findings on a subtree while still analyzing the full project context:

```bash
npx scan-react-css ./packages/web --focus src/features/payments
```

Emit JSON to stdout:

```bash
npx scan-react-css --json
```

Include debug findings and trace detail:

```bash
npx scan-react-css --json --debug
```

## CLI Usage

```bash
scan-react-css [rootDir] [--config path] [--focus path-or-glob] [--json] [--trace]
```

Supported flags:

- `--config path/to/scan-react-css.json`
- `--focus path-or-glob`
- `--json`
- `--trace`
- `--debug` alias for `--trace`
- `--help`

`rootDir` must be a directory. File paths and missing paths fail with a clear diagnostic.

### Focused Output

`--focus` is an output filter, not a smaller analysis root. The scanner still loads and analyzes the full project root so imports, global CSS, render relationships, and reachability context remain available.

Details:

- `--focus` can be provided more than once.
- A focus value can contain comma-separated paths.
- Non-glob values match an exact file or directory subtree.
- Glob values use project-relative `/` paths and support `*`, `?`, and `**`.
- Source, CSS, class-reference, class-definition, and selector-query counts describe the full project context.
- Finding counts and the CLI exit code are based on the focused findings.
- Error diagnostics are not hidden by focus.

Examples:

```bash
npx scan-react-css --focus src/components
npx scan-react-css --focus src/components,src/pages
npx scan-react-css --focus "src/features/**/components"
```

### Current Unsupported Flags

These historical flags are recognized but not supported in this build yet:

- `--output-file`
- `--overwrite-output`
- `--print-config`
- `--verbosity`
- `--output-min-severity`

Today, `--json` prints the JSON payload to stdout. Planned compatibility work will restore file output behavior.

## Config

The config file is JSON and defaults to `scan-react-css.json`.

Discovery order:

1. explicit `--config` or API `configPath`
2. project-root `scan-react-css.json`
3. `SCAN_REACT_CSS_CONFIG_DIR/scan-react-css.json`
4. first `scan-react-css.json` found on the OS `PATH`
5. built-in defaults

Only one config source is loaded. There is no config merging.

Current config shape:

```json
{
  "failOnSeverity": "error",
  "rules": {
    "unused-css-class": "warn",
    "dynamic-class-reference": "info",
    "unsupported-syntax-affecting-analysis": "off"
  },
  "cssModules": {
    "localsConvention": "camelCase"
  }
}
```

`failOnSeverity` accepts `debug`, `info`, `warn`, or `error`.

Rule values accept `off`, `debug`, `info`, `warn`, or `error`.

CSS Module `localsConvention` accepts:

- `asIs`
- `camelCase`
- `camelCaseOnly`

## Rules

Default rules:

- `missing-css-class` defaults to `error`
- `css-class-unreachable` defaults to `error`
- `unused-css-class` defaults to `warn`
- `missing-css-module-class` defaults to `error`
- `unused-css-module-class` defaults to `warn`
- `unsatisfiable-selector` defaults to `warn`
- `compound-selector-never-matched` defaults to `warn`
- `unused-compound-selector-branch` defaults to `warn`
- `single-component-style-not-colocated` defaults to `info`
- `style-used-outside-owner` defaults to `warn`
- `style-shared-without-shared-owner` defaults to `info`
- `dynamic-class-reference` defaults to `info`
- `unsupported-syntax-affecting-analysis` defaults to `debug`

Findings carry both severity and confidence. Debug findings are hidden from normal CLI output unless `--debug` or `--trace` is used.

## Node API

```ts
import { scanProject } from "scan-react-css";

const result = await scanProject({
  rootDir: process.cwd(),
  configPath: "scan-react-css.json",
});

console.log(result.summary);
console.log(result.findings);
```

`scanProject()` accepts:

```ts
type ScanProjectInput = {
  rootDir?: string;
  sourceFilePaths?: string[];
  cssFilePaths?: string[];
  configPath?: string;
};
```

The result contains:

- `rootDir`
- `config`
- `diagnostics`
- `findings`
- `summary`
- `failed`
- discovered `files`

Raw engine internals are not exposed through the public API result.

## Output And CI

The CLI exits non-zero when:

- an error diagnostic is produced, or
- a finding meets `failOnSeverity`

Default policy:

- `error` findings fail the scan
- `warn`, `info`, and `debug` findings do not

Human-readable output is intended for local use. JSON output is deterministic and intended for tooling and CI.
