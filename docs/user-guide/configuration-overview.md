# Configuration Overview

This page explains how `react-css-scanner` configuration works at a practical level.

## File Name And Discovery

The default config file name is:

```json
react-css-scanner.json
```

The scanner looks for config in this order:

1. `--config path/to/react-css-scanner.json`
2. `react-css-scanner.json` in the project root
3. `REACT_CSS_SCANNER_CONFIG_DIR/react-css-scanner.json`
4. the first `react-css-scanner.json` found on the OS `PATH`
5. built-in defaults

Only one config source is loaded. Config files are not merged.

## Minimal Example

```json
{
  "css": {
    "global": ["src/styles/global.css"]
  }
}
```

That is enough for many projects.

## Full Example

```json
{
  "$schema": "./node_modules/react-css-scanner/schema.json",
  "rootDir": ".",
  "source": {
    "include": ["src", "packages/web/src"],
    "exclude": ["dist", "build", "coverage", "node_modules", "**/*.stories.tsx"]
  },
  "css": {
    "global": ["src/styles/global.css", "src/styles/reset/**/*.css"],
    "utilities": ["src/styles/utilities.css", "src/styles/utilities/**/*.css"],
    "modules": {
      "enabled": true,
      "patterns": ["**/*.module.css"]
    }
  },
  "ownership": {
    "pagePatterns": ["src/pages/**/*", "src/routes/**/*"],
    "componentCssPatterns": ["src/components/**/*.css"],
    "namingConvention": "sibling"
  },
  "externalCss": {
    "enabled": true,
    "mode": "imported-only"
  },
  "classComposition": {
    "helpers": ["classnames", "clsx"]
  },
  "policy": {
    "failOnSeverity": "warning"
  },
  "rules": {
    "missing-css-class": "error",
    "unreachable-css": "error",
    "unused-css-class": "warning",
    "global-css-not-global": "off",
    "component-css-should-be-global": {
      "severity": "info",
      "threshold": 8
    },
    "utility-class-replacement": {
      "severity": "info",
      "minDeclarationOverlap": 2
    },
    "repeated-style-pattern": {
      "severity": "info",
      "minOccurrences": 3,
      "minDeclarations": 3
    }
  }
}
```

## What Each Section Does

### `$schema`

Optional editor-help path for schema-aware tooling.

### `rootDir`

Defines the project root used for path resolution.

### `source`

Controls which source files are scanned and which are ignored.

### `css`

Controls how project CSS is categorized:

- global CSS
- utility CSS
- CSS Modules

### `ownership`

Controls how CSS is classified as page-level or component-level.

### `externalCss`

Controls whether imported dependency CSS is parsed.

### `classComposition`

Tells the scanner which helper libraries compose class names.

### `policy`

Controls when the CLI exits with failure for CI.

### `rules`

Lets you change rule severities and configure rule-specific thresholds.

## Defaults

If no config file is found, the scanner behaves like this:

```json
{
  "rootDir": ".",
  "source": {
    "include": ["src"],
    "exclude": ["dist", "build", "coverage", "node_modules"]
  },
  "css": {
    "global": [],
    "utilities": ["**/utilities.css", "**/utilities/**/*.css"],
    "modules": {
      "enabled": true,
      "patterns": ["**/*.module.css"]
    }
  },
  "ownership": {
    "pagePatterns": ["src/pages/**/*", "src/routes/**/*"],
    "componentCssPatterns": [],
    "namingConvention": "off"
  },
  "externalCss": {
    "enabled": true,
    "mode": "imported-only"
  },
  "classComposition": {
    "helpers": ["classnames", "clsx"]
  },
  "policy": {
    "failOnSeverity": "error"
  },
  "rules": {
    "component-css-should-be-global": {
      "severity": "info",
      "threshold": 8
    },
    "repeated-style-pattern": {
      "severity": "info",
      "minOccurrences": 3,
      "minDeclarations": 3
    },
    "utility-class-replacement": {
      "severity": "info",
      "minDeclarationOverlap": 2
    }
  }
}
```

If built-in defaults are used because no config file was found, the CLI emits an operational warning.

For every supported option, see [Configuration Reference](./configuration-reference.md).
