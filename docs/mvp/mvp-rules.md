# MVP Rules

## Purpose

This document defines the MVP rule catalog for `react-css-scanner`.

It serves three purposes:

- preserve the minimum rule coverage from the legacy Loremaster script
- identify additional rule candidates unlocked by the new indexing model
- suggest default severities and grouping by rule family

This is a rule-design document, not yet the final implementation plan for each rule.

## Rule design principles

- Rules must have stable IDs.
- Rules may belong to a rule family for readability.
- Severity and confidence are separate concerns.
- A high-severity rule may still produce a low-confidence finding.
- The MVP should favor a smaller, coherent rule set over a large but fuzzy one.

## Severity scale

Suggested default severity meanings:

- `error`: should typically fail CI by default
- `warning`: important, but not necessarily build-breaking by default
- `info`: advisory or optimization-oriented

## Legacy rule baseline

The MVP must cover at least the intent of the legacy Loremaster script.

Legacy rule IDs:

- `missing-css-class`
- `unused-css-class`
- `manual-review`
- `page-style-used-by-single-component`
- `component-style-cross-component`
- `shared-style-not-shared`
- `layout-replacement-advisory`

Not all of these should necessarily survive unchanged in the standalone tool, but the MVP should preserve the corresponding product behavior where it still fits the new design.

## Recommended MVP rule families

### 1. Definition and usage integrity

These rules answer basic questions such as:

- is a referenced class actually defined?
- is a defined class actually used?
- is the CSS containing the class reachable?

#### `missing-css-class`

Family:

- definition-and-usage-integrity

Intent:

- A class referenced by React code does not have a matching definition in reachable project or imported external CSS.

Suggested default severity:

- `error`

Legacy status:

- carry over directly

Why it matters:

- This is one of the clearest broken-style signals.

#### `unused-css-class`

Family:

- definition-and-usage-integrity

Intent:

- A class is defined in CSS but has no convincing usage in reachable React code or CSS relationships.

Suggested default severity:

- `warning`

Legacy status:

- carry over directly, but consider lowering from legacy `error` to `warning`

Why:

- It is usually important, but often less urgent than a true missing definition.

Decision:

- Locked for MVP as `warning` by default.

#### `unreachable-css`

Family:

- definition-and-usage-integrity

Intent:

- A class is defined somewhere, but not in CSS that is reachable for the module using it.

Suggested default severity:

- `error`

Legacy status:

- new standalone-tool rule, enabled by the new reachability model

Why:

- This is one of the main benefits of the new architecture and should be a flagship MVP rule.

### 2. Ownership and code organization

These rules are about whether CSS lives in the right place and is used by the right scope.

#### `component-style-cross-component`

Family:

- ownership-and-organization

Intent:

- CSS intended to be local to one component is used by other components.

Suggested default severity:

- `warning`

Legacy status:

- carry over directly

Why:

- Important architectural smell, but may not always be a hard failure.

Notes:

- This should remain a usage-boundary rule, not a filename-convention rule.
- A separate convention rule can cover whether component-local styles are expected to live in a matching file such as `Button.css`.

#### `component-css-file-convention`

Family:

- ownership-and-organization

Intent:

- A component appears to have local/component-specific CSS, but that CSS is not colocated in the expected matching file pattern such as `Button.css`.

Suggested default severity:

- `off`

Legacy status:

- new candidate rule

Why:

- This is opinionated and project-specific.
- It could be valuable if made configurable, but should not be enabled by default for all projects.

#### `page-style-used-by-single-component`

Family:

- ownership-and-organization

Intent:

- Page-level CSS is effectively only serving one component and may belong closer to that component.

Suggested default severity:

- `info`

Legacy status:

- carry over in spirit

Why:

- This is architectural advice rather than a broken state.

Notes:

- This rule requires page classification to be configurable rather than assumed.
- The MVP config should support repo-relative `ownership.pagePatterns`.

#### `global-css-not-global`

Family:

- ownership-and-organization

Intent:

- CSS configured as global is only used in one narrow place and may not belong in the global tier.

Suggested default severity:

- `info`

Legacy status:

- modernized replacement for `shared-style-not-shared`

Why:

- Useful organizational feedback, but not a correctness problem.

Notes:

- This rule depends on `css.global`.

#### `component-css-should-be-global`

Family:

- ownership-and-organization

Intent:

- A supposedly local CSS file is referenced broadly enough that it may really be global styling.

Suggested default severity:

- `info`

Legacy status:

- new candidate rule

Why:

- This is useful, but probably not part of the first implemented wave.

Notes:

- This rule should use rule-specific config such as `rules["component-css-should-be-global"].threshold`.

### 3. Dynamic and uncertain analysis

These rules capture situations where static analysis sees a likely problem but with reduced confidence.

#### `dynamic-class-reference`

Family:

- dynamic-analysis

Intent:

- A class reference comes from dynamic composition and the scanner cannot fully prove the final class set.

Suggested default severity:

- `warning`

Legacy status:

- replaces the legacy `manual-review` bucket with a more specific standalone-tool rule

Why:

- The new tool should prefer specific low-confidence findings over one vague catch-all.

Notes:

- Dynamic findings should not automatically be warnings just because they are dynamic.
- Severity should come from the rule, while uncertainty should be expressed via confidence such as `low` or `medium`.
- In practice, many dynamic-analysis findings will likely default to `warning`, but that is a rule decision rather than a property of dynamic references in general.

#### `dynamic-missing-css-class`

Family:

- dynamic-analysis

Intent:

- A class appears likely to be referenced dynamically, but no matching definition can be confirmed.

Suggested default severity:

- `warning`

Legacy status:

- modernized replacement for part of legacy `manual-review`

Why:

- More specific than a generic manual-review rule and better aligned with the confidence model.

#### `dynamic-css-module-reference`

Family:

- dynamic-analysis

Intent:

- A CSS Module property is accessed dynamically, so the exact class usage cannot be resolved confidently.

Suggested default severity:

- `info`

Legacy status:

- new candidate rule

Why:

- Likely useful, but advisory in MVP.

### 4. CSS Modules

These rules exist because CSS Modules are a distinct usage mode and should not be treated exactly like raw string classes.

#### `missing-css-module-class`

Family:

- css-modules

Intent:

- A referenced CSS Module property does not correspond to a class in the imported module file.

Suggested default severity:

- `error`

Legacy status:

- new rule enabled by MVP CSS Module support

Why:

- This is the CSS Module equivalent of `missing-css-class`.

#### `unused-css-module-class`

Family:

- css-modules

Intent:

- A class defined in a CSS Module file appears unused by the importing module(s).

Suggested default severity:

- `warning`

Legacy status:

- new candidate rule

Why:

- Consistent with ordinary unused-class analysis.

### 5. External CSS

These rules are specifically about imported package CSS such as Bootstrap or Radix theme styles.

#### `missing-external-css-class`

Family:

- external-css

Intent:

- A class appears intended to come from imported external CSS, but no matching class can be found in the imported external stylesheet(s).

Suggested default severity:

- `error`

Legacy status:

- new candidate rule

Why:

- This becomes possible because MVP now parses actually imported dependency CSS.

#### `unused-external-css-import`

Family:

- external-css

Intent:

- An external stylesheet is imported but appears to provide no used classes in the scanned scope.

Suggested default severity:

- `info`

Legacy status:

- new candidate rule

Why:

- Potentially useful, but more advisory than correctness-oriented.

### 6. Optimization and migration advisories

These rules suggest improvements rather than indicating a broken state.

#### `utility-class-replacement`

Family:

- optimization-and-migration

Intent:

- A custom class could potentially be replaced with an existing utility-class pattern already available in the project.

Suggested default severity:

- `info`

Legacy status:

- carry over in spirit, but rename to remove project-specific `layouts.css` terminology

Why:

- Useful advice, but clearly non-blocking.

Notes:

- This rule depends on `css.utilities`.
- This rule should use rule-specific config such as `rules["utility-class-replacement"].minDeclarationOverlap`.

#### `duplicate-css-class-definition`

Family:

- optimization-and-migration

Intent:

- The same class name is defined in multiple places in a way that is likely confusing or redundant.

Suggested default severity:

- `warning`

Legacy status:

- new candidate rule

Why:

- This is a strong smell and the index should make it relatively straightforward to detect.

Notes:

- This rule is about the same class name being defined multiple times.
- The rule name and intent should stay tightly aligned so the behavior is obvious.

#### `repeated-style-pattern`

Family:

- optimization-and-migration

Intent:

- Similar or identical declaration sets appear under multiple different class names often enough to suggest avoidable duplication.

Suggested default severity:

- `info`

Legacy status:

- new candidate rule

Why:

- This is a weaker smell than duplicate class-name definitions.
- Some duplication is normal, so this rule should likely require a threshold such as three or more repeated declaration patterns before reporting.
- This is probably better treated as an optimization/advisory rule than a correctness rule.

Notes:

- This rule should use rule-specific config such as `rules["repeated-style-pattern"].minOccurrences` and `rules["repeated-style-pattern"].minDeclarations`.

## Recommended MVP implementation set

This is the locked MVP implementation set.

### Tier 1: Core MVP rules

- `missing-css-class` - `error`
- `unreachable-css` - `error`
- `unused-css-class` - `warning`
- `component-style-cross-component` - `warning`
- `global-css-not-global` - `info`
- `utility-class-replacement` - `info`
- `dynamic-class-reference` - `warning`
- `missing-css-module-class` - `error`

### Tier 2: Good MVP stretch rules

- `page-style-used-by-single-component` - `info`
- `dynamic-missing-css-class` - `warning`
- `unused-css-module-class` - `warning`
- `missing-external-css-class` - `error`
- `duplicate-css-class-definition` - `warning`
- `component-css-should-be-global` - `info`

## Legacy-to-MVP mapping suggestion

Suggested mapping from legacy rules to the standalone tool:

- `missing-css-class` -> keep
- `unused-css-class` -> keep, but likely default to `warning`
- `manual-review` -> replace with more specific lower-confidence rules such as `dynamic-class-reference` and `dynamic-missing-css-class`
- `page-style-used-by-single-component` -> keep, likely as `info`
- `component-style-cross-component` -> keep
- `shared-style-not-shared` -> replace with `global-css-not-global`
- `layout-replacement-advisory` -> rename to `utility-class-replacement`
- `utility-class-replacement` -> rename from legacy `layout-replacement-advisory`

## Suggested rule family list

For grouping in docs and output, use these families:

- `definition-and-usage-integrity`
- `ownership-and-organization`
- `dynamic-analysis`
- `css-modules`
- `external-css`
- `optimization-and-migration`

## Open questions

- Should `missing-external-css-class` be part of the first implementation wave, or only after external CSS parsing is proven stable?
- Should CSS Module findings use dedicated rule IDs or reuse generic class-definition rules with metadata?
- Do we want one generic low-confidence dynamic rule, or several specific dynamic rule IDs from day one?
- Do we want a configurable component-to-CSS filename convention rule, and if so what default file-matching patterns should it support?

