# Runtime Contracts

## Purpose

This document defines the main runtime-facing contracts for the MVP of `react-css-scanner`.

It is intended to answer:

- what the CLI accepts
- what the CLI returns
- what the Node API should return
- what a finding looks like at runtime
- how config resolution behaves
- how severity, confidence, and exit codes interact

This is a first-pass contract document for MVP. It should be treated as the operational companion to:

- [requirements.md](./requirements.md)
- [architecture.md](./architecture.md)
- [config-schema.md](./config-schema.md)
- [config-contract.md](./config-contract.md)
- [mvp-rules.md](./mvp-rules.md)

## Runtime surface areas

The MVP has two primary runtime surfaces:

- CLI
- Node API

Both should use the same core analysis engine and the same finding model.

## Config resolution contract

### Resolution order

The scanner should resolve config in this order:

1. explicit CLI/API config path
2. project-root `react-css-scanner.json`
3. `REACT_CSS_SCANNER_CONFIG_DIR/react-css-scanner.json`
4. first `react-css-scanner.json` found on the OS `PATH`
5. built-in defaults

### Resolution behavior

- The scanner should load exactly one config source.
- It should not merge multiple config files in MVP.
- If no config file is found, built-in defaults should be used.
- If built-in defaults are used because no config file was found, the CLI should emit a warning recommending that the user create a config file.

### Resolved config shape

The runtime config contract is defined in:

- [src/config/types.ts](/c:/Users/georg/Desktop/react-css-scanner/src/config/types.ts)

Primary types:

- `RawReactCssScannerConfig`
- `ResolvedReactCssScannerConfig`
- `DEFAULT_CONFIG`

## CLI contract

### Core command

The MVP CLI should support the package binary:

```bash
react-css-scanner
```

### Primary CLI inputs

First-pass expected inputs:

- target path, optional
- config path override, optional
- output mode, optional
- minimum human-readable output severity, optional
- JSON output destination, optional

### Suggested CLI syntax

This is a suggested MVP direction, not yet the final parser implementation:

```bash
react-css-scanner [targetPath] [--config path/to/react-css-scanner.json] [--json] [--output-min-severity warning] [--output-file ./reports/react-css-scanner.json] [--overwrite-output] [--config-summary default] [--output-mode default]
```

### CLI behavior

- If `targetPath` is omitted, the scanner should use its default configured scan root behavior.
- If `--config` is provided, it should override discovery.
- If `--json` is provided, the scanner should emit machine-readable JSON output.
- Without `--json`, the scanner should emit human-readable terminal output.
- If `--output-min-severity` is provided, findings below that severity should be filtered out of human-readable terminal output only.
- If `--output-file` is provided with `--json`, the JSON result should be written to that file.
- If `--output-file` is provided without `--json`, the CLI should fail early with exit code `1` and a message stating that `--output-file` requires `--json`.
- If `--output-min-severity` is provided together with `--json`, the CLI should fail early with exit code `1` and a message stating that `--output-min-severity` only applies to human-readable output.
- If `--output-file` points to an existing file and `--overwrite-output` is not set, the CLI should save to the first available suffixed filename such as `report-1.json`, `report-2.json`, and so on.
- If `--overwrite-output` is provided, the CLI may overwrite the destination file.
- If `--config-summary` is provided, it should control how much config information is included in JSON output.
- If `--output-mode` is provided, it should control how much human-readable detail is printed.

### CLI output modes

The MVP should support:

- human-readable summary + findings
- JSON output

### Suggested MVP flags

- `--config path/to/react-css-scanner.json`
- `--json`
- `--output-min-severity info|warning|error`
- `--output-file path/to/report.json`
- `--overwrite-output`
- `--config-summary off|default|verbose`
- `--output-mode minimal|default|verbose`

## Node API contract

### High-level API expectation

The package should expose a Node API for programmatic scans.

Current package exports already expose:

- `scan`
- `scanReactCss`

The MVP runtime contract should move toward a structured return shape rather than a raw legacy bridge over time.

### Suggested Node API shape

First-pass target shape:

```ts
type ScanInput = {
  targetPath?: string;
  configPath?: string;
  config?: RawReactCssScannerConfig;
};

type ScanResult = {
  config: ResolvedReactCssScannerConfig;
  findings: Finding[];
  summary: ScanSummary;
};
```

This does not need to be fully implemented immediately, but it should be the direction of the runtime contract.

## Scan result contract

### Suggested top-level shape

```ts
type ScanResult = {
  config: ResolvedReactCssScannerConfig;
  findings: Finding[];
  summary: ScanSummary;
};
```

### Suggested summary shape

```ts
type ScanSummary = {
  fileCount: number;
  sourceFileCount: number;
  cssFileCount: number;
  findingCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
};
```

This should be treated as the summary direction for MVP.

## Finding contract

### Core finding shape

Suggested finding runtime shape:

```ts
type Finding = {
  ruleId: string;
  family: string;
  severity: "info" | "warning" | "error";
  confidence: "low" | "medium" | "high";
  message: string;
  primaryLocation?: FindingLocation;
  relatedLocations: FindingLocation[];
  subject?: FindingSubject;
  metadata: Record<string, unknown>;
};
```

### Location shape

```ts
type FindingLocation = {
  filePath: string;
  line?: number;
  column?: number;
  context?: string;
};
```

### Subject shape

```ts
type FindingSubject = {
  className?: string;
  cssFilePath?: string;
  sourceFilePath?: string;
};
```

### Field meanings

- `ruleId`: stable rule identifier
- `family`: rule family for grouping and display
- `severity`: policy importance
- `confidence`: analysis certainty
- `message`: human-readable explanation
- `primaryLocation`: main location for display
- `relatedLocations`: supporting locations
- `subject`: key entity involved in the finding
- `metadata`: rule-specific structured detail

### Primary location requirement

- If a relevant file/location is known, `primaryLocation` should be present.
- It may be omitted only when the scanner genuinely cannot identify one meaningful primary location.

## Severity contract

Allowed severity levels:

- `info`
- `warning`
- `error`

Meaning:

- `error`: should fail CI by default when policy says fail on error
- `warning`: important but usually non-blocking by default
- `info`: advisory

Config-only severity:

- `off`

`off` is a configuration value, not a runtime finding severity.

## Confidence contract

Allowed confidence levels:

- `low`
- `medium`
- `high`

Meaning:

- `high`: the scanner is very confident in the finding
- `medium`: the scanner has partial certainty, but some interpretation is involved
- `low`: the scanner sees a likely issue, but dynamic or ambiguous analysis limits certainty

Severity and confidence must remain separate.

## Rule contract

Each runtime finding must map to a stable rule ID defined by the rule catalog in:

- [mvp-rules.md](./mvp-rules.md)

Suggested MVP rule families:

- `definition-and-usage-integrity`
- `ownership-and-organization`
- `dynamic-analysis`
- `css-modules`
- `external-css`
- `optimization-and-migration`

## Exit-code contract

### Success and failure

The CLI should use:

- `0` when no configured policy threshold is breached
- non-zero when configured policy thresholds are breached

### Default policy behavior

With default config:

- findings with severity `error` should cause a failing exit code
- `warning` and `info` should not fail the scan by default

Output filtering flags should not change policy evaluation.

### Non-policy failures

The CLI should also return non-zero for operational failures such as:

- unreadable explicit config path
- invalid config
- invalid CLI arguments
- fatal scanner/runtime exceptions

## Human-readable output contract

The human-readable output should include:

- scan target
- config source used
- summary counts
- findings grouped or listed in a stable order

Suggested stable ordering:

1. severity
2. confidence
3. subject/class name
4. file path

Detailed interpretation:

- severity should sort highest first: `error`, then `warning`, then `info`
- confidence should sort highest first: `high`, then `medium`, then `low`
- then use alphabetical ordering for the main subject key such as class name
- then use file path as a final stable tiebreaker

This should be the default deterministic ordering.

## JSON output contract

The JSON output should be deterministic and structured.

Suggested MVP JSON shape:

```json
{
  "config": {
    "rootDir": "."
  },
  "summary": {
    "findingCount": 0,
    "errorCount": 0,
    "warningCount": 0,
    "infoCount": 0
  },
  "findings": []
}
```

### Config summary modes

The JSON output should not include the full resolved config by default.

Suggested config summary modes:

- `off`: omit config summary from JSON output
- `default`: include a small config summary
- `verbose`: include the full resolved config

Suggested default:

- `default`

`--output-min-severity` should not affect JSON output.
If `--json` is enabled, JSON should include the full unfiltered result for that run.

### Human-readable output modes

For MVP, output customization should use simple modes rather than a free-form print schema.

Suggested output modes:

- `minimal`
- `default`
- `verbose`

Suggested default:

- `default`

### Human-readable grouping

By default, human-readable findings should be grouped by CSS class when a class subject exists.

This is a presentation rule, not a change to the underlying finding model.
For MVP, this grouping should be fixed rather than configurable.

## Determinism contract

For the same:

- file tree
- config
- CLI options

the scanner should produce:

- the same findings
- the same summary
- the same exit-code behavior
- stable output ordering

This matters for CI reliability and snapshot-based testing.

## Operational warning contract

Warnings that are not findings should be used sparingly.

The main expected MVP operational warning is:

- no config file discovered, built-in defaults used

This warning should not be emitted as a finding.
It should be emitted as operational CLI output only.

## Open questions

- Should the saved JSON output include the final resolved output path when suffixing was needed?
- Should the CLI print the final saved output path explicitly whenever `--output-file` is used?
