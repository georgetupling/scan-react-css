# Post-MVP Ideas

## Purpose

This document captures ideas that are valuable, interesting, or likely to improve accuracy, but which should not define the MVP implementation scope.

The goal is to preserve them without letting them blur the first build.

## React render-tree heuristics for inherited CSS reachability

One possible future enhancement is to infer likely CSS reachability from observed React component nesting patterns.

### Motivation

Some components may appear to use classes from CSS imported by an ancestor component rather than from their own direct imports.

Example shape:

- `HomePage` imports `HomePage.css`
- `HomePagePanel` is only ever rendered inside `HomePage`
- `HomePagePanel` uses classes defined in `HomePage.css`

Without additional heuristics, the scanner may flag `HomePagePanel` as using unreachable CSS.

### Possible heuristic

1. Build a graph of which React components render which other components.
2. For each component type, collect all observed ancestor chains across its usages.
3. Find ancestors that appear in every observed ancestor chain for that component type.
4. Treat CSS imported by those always-present ancestors as a possible inherited CSS source for that component.

### Why this is attractive

- It may reduce false positives in page/layout-driven component trees.
- It reflects how some teams actually structure page-local CSS.
- It could provide useful hints for otherwise ambiguous ownership cases.

### Why it should not be part of MVP correctness

- Static analysis may miss render sites.
- Conditional rendering and composition patterns make ancestry incomplete or unstable.
- A component being nested under the same ancestor does not prove the ancestor's CSS is intended for that child.
- One missed render site can make the inference unsound.

### Recommended future use

If implemented later, this heuristic should be used conservatively:

- as a confidence-lowering mechanism
- as explanatory metadata
- not as a hard proof that unreachable-CSS findings should disappear

## Additional post-MVP ideas

- framework-aware entrypoint detection
- route/layout-tree analysis for frameworks like Next.js or Remix
- deeper CSS Modules handling
- richer ownership scopes beyond local/global/external
- transitive external CSS `@import` support
- project presets for common app structures
- safe autofix support for high-confidence deterministic cases

## MVP boundary reminder

The MVP reachability model should stay focused on:

- direct CSS imports
- configured global CSS
- imported external CSS
- possibly configured app entry files
