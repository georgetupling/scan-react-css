# AGENTS.md

## Project purpose

`react-css-scanner` is being built as a standalone npm tool for auditing how React code uses CSS.

The MVP goal is:

- installable CLI + Node API
- configurable via JSON
- graph/index-based analysis of source files, CSS files, CSS Modules, and imported external CSS
- deterministic findings with severity + confidence
- CI-friendly behavior

This project is currently design-heavy and implementation-light.

## Current status

The MVP design is now fairly well specified.

The current work should follow the implementation sequence in:

- [docs/mvp/implementation-plan.md](./docs/mvp/implementation-plan.md)

Do not improvise the architecture from scratch each session.
Read the docs, then implement the next phase cleanly.

## Doc map

Start here:

- [docs/README.md](./docs/README.md)

MVP docs:

- [docs/mvp/requirements.md](./docs/mvp/requirements.md)
- [docs/mvp/architecture.md](./docs/mvp/architecture.md)
- [docs/mvp/config-schema.md](./docs/mvp/config-schema.md)
- [docs/mvp/config-contract.md](./docs/mvp/config-contract.md)
- [docs/mvp/mvp-rules.md](./docs/mvp/mvp-rules.md)
- [docs/mvp/runtime-contracts.md](./docs/mvp/runtime-contracts.md)
- [docs/mvp/testing-plan.md](./docs/mvp/testing-plan.md)
- [docs/mvp/implementation-plan.md](./docs/mvp/implementation-plan.md)

Future-only docs:

- [docs/future-work/post-mvp-ideas.md](./docs/future-work/post-mvp-ideas.md)
- [docs/future-work/future-notes.md](./docs/future-work/future-notes.md)

## Source of truth hierarchy

When working, use this priority order:

1. `docs/mvp/implementation-plan.md`
2. `docs/mvp/runtime-contracts.md`
3. `docs/mvp/config-contract.md`
4. `docs/mvp/mvp-rules.md`
5. `docs/mvp/architecture.md`
6. `docs/mvp/config-schema.md`
7. `docs/mvp/requirements.md`

If docs disagree, do not silently guess.
Either:

- align them in the same change, or
- call out the mismatch explicitly

## Important MVP decisions already locked

### Config

- Config format is JSON.
- Discovery order is:
  1. explicit `--config`
  2. project-root `react-css-scanner.json`
  3. `REACT_CSS_SCANNER_CONFIG_DIR/react-css-scanner.json`
  4. first `react-css-scanner.json` found on OS `PATH`
  5. built-in defaults
- Only one config source is loaded.
- No config merging in MVP.
- If no config is found, built-in defaults are used and the CLI should warn.

### Ownership model

CSS ownership kinds are:

- `component`
- `page`
- `global`
- `utility`
- `external`
- `unclassified`

`unclassified` is important. Do not force a stronger classification if the scanner cannot justify it.

### Reachability model

MVP reachability focuses on:

- direct CSS imports
- configured global CSS
- imported external CSS
- optionally configured app entry files if needed by the implementation approach

Do not implement post-MVP render-tree ancestry heuristics in MVP code paths.

### Confidence model

Confidence is:

- `low`
- `medium`
- `high`

Do not reintroduce `tentative`.

Severity and confidence are separate.

### Runtime behavior

- `--output-min-severity` is for human-readable output only.
- It must error if used with `--json`.
- `--output-file` requires `--json`.
- `--output-file` must not overwrite by default.
- Use suffixed filenames like `-1`, `-2`, etc. unless `--overwrite-output` is provided.

### Rules

The rule catalog lives in:

- [docs/mvp/mvp-rules.md](./docs/mvp/mvp-rules.md)

Tier 1 locked MVP rules:

- `missing-css-class`
- `unreachable-css`
- `unused-css-class`
- `component-style-cross-component`
- `global-css-not-global`
- `utility-class-replacement`
- `dynamic-class-reference`
- `missing-css-module-class`

`unused-css-class` is locked to `warning` by default.

## Current code structure

Current `src/` is still minimal:

- [src/index.ts](./src/index.ts)
- [src/cli.ts](./src/cli.ts)
- [src/legacy.ts](./src/legacy.ts)
- [src/config/types.ts](./src/config/types.ts)

The legacy bridge exists, but it is not the target architecture.

## Legacy code warning

There is legacy code in:

- `legacy-code-not-part-of-mvp/`

Treat it as reference material only unless explicitly needed.

Do not let legacy structure dictate the new architecture.

## Testing expectations

Testing is intentionally integration-heavy.

Read:

- [docs/mvp/testing-plan.md](./docs/mvp/testing-plan.md)

Important testing decisions:

- no Docker for the main test strategy
- use generated fake React projects
- use a file-oriented `TestProjectBuilder`
- support resource-file loading helpers

## Preferred implementation order

Follow the phases in `implementation-plan.md`.

In practice, the near-term next steps are:

1. config loading + normalization
2. file discovery
3. fact extraction
4. project model + ownership classification
5. reachability

Do not jump straight to implementing lots of rules before the model exists.

## When editing docs

- Keep MVP content under `docs/mvp`
- Keep non-MVP ideas under `docs/future-work`
- Do not mix future-work ideas back into MVP docs

If you add new operational behavior, update:

- `runtime-contracts.md`
- `config-schema.md` or `config-contract.md`
- `implementation-plan.md` if the phase plan changes

## Things to be careful about

- Do not reintroduce “shared” as a separate MVP ownership tier unless the docs are intentionally changed.
- Do not treat config thresholds as top-level ownership config if they are really rule-specific.
- Do not silently merge config files.
- Do not make output filtering affect JSON unless the runtime contract is intentionally changed.
- Do not assume every non-page thing is a component; `unclassified` exists for a reason.

## If you need to reorient quickly

Read in this order:

1. [docs/mvp/implementation-plan.md](./docs/mvp/implementation-plan.md)
2. [docs/mvp/runtime-contracts.md](./docs/mvp/runtime-contracts.md)
3. [docs/mvp/config-contract.md](./docs/mvp/config-contract.md)
4. [docs/mvp/mvp-rules.md](./docs/mvp/mvp-rules.md)
5. [docs/mvp/architecture.md](./docs/mvp/architecture.md)

That should be enough to resume work without rereading everything else first.
