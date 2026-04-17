# Future Notes

## Purpose

This document collects non-MVP design ideas that were intentionally removed from the MVP docs so the implementation guidance stays focused.

## Configuration evolution

Potential future config additions:

- additional helper package names beyond `classnames` and `clsx`
- custom helper signatures
- extra policy controls such as `failOnRuleIds`, `maxWarnings`, or confidence-aware policy options
- expanded rule object syntax
- `extends`
- named presets such as `"react-app"` or `"nextjs"`
- ownership overrides by path pattern
- file-specific ignores
- inline suppression support

## Architecture evolution

Potential future architecture extensions:

- rule-specific policy override handling beyond severity thresholds
- more helper libraries
- more advanced CSS Modules handling
- deeper dependency inspection
- additional style formats
- future autofix metadata and execution support

Example future autofix metadata:

```ts
type FixCapability = {
  canAutoFix: boolean;
  reason?: string;
};
```

## Requirements evolution

Potential future product capabilities:

- safe autofix support for deterministic high-confidence cases
- richer custom reporting and integrations
- expansion of rule coverage beyond the initial MVP set

## Testing evolution

Potential future testing additions:

- internal per-stage timing instrumentation for benchmarks
- additional large-scale performance baselines
- broader fixture libraries as rule coverage expands
