# Static Analysis Engine Reachability Branch-Local Context Note

## Purpose

This note captures the next planned reachability step after:

- source-file contexts
- component contexts
- render-subtree-root contexts
- render-graph propagation with `definite` versus `possible`

The remaining gap is that reachability is still too coarse inside a component subtree.

Today the engine can say:

- this stylesheet is available for component `Layout`
- this stylesheet is available for the subtree root of `Layout`

But it cannot yet say:

- this stylesheet is available only on the `whenTrue` branch of a conditional region
- this stylesheet is only possibly available inside a repeated-region template
- this subtree root is definite, but one nested branch-local region is only possible

That is the next bounded improvement.

## Design Goal

Add branch-local reachability contexts so availability can be attached to finer-grained render regions instead of only whole component roots.

This should let selector-analysis eventually distinguish:

- structurally reachable and definitely available
- structurally reachable and only possibly available on one branch
- structurally reachable but unavailable on the relevant branch-local region

## Proposed Shape

Introduce a render-region collector over `RenderSubtree[]`.

The collector should produce stable normalized region records with:

- owning `filePath`
- owning `componentName`
- a stable region anchor
- a bounded region-path identity
- region kind metadata

An example working shape:

```ts
type RenderRegionPathSegment =
  | { kind: "root" }
  | { kind: "fragment-child"; childIndex: number }
  | { kind: "conditional-branch"; branch: "when-true" | "when-false" }
  | { kind: "repeated-template" };

type RenderRegionKind =
  | "subtree-root"
  | "fragment-child"
  | "conditional-branch"
  | "repeated-template";

type RenderRegion = {
  filePath: string;
  componentName?: string;
  kind: RenderRegionKind;
  path: RenderRegionPathSegment[];
  sourceAnchor: SourceAnchor;
};
```

This is intentionally descriptive, not yet a full semantic contract.

## First Supported Regions

The first region collector should cover:

- subtree root
- conditional `whenTrue`
- conditional `whenFalse`
- repeated-region template

It may also include fragment-child path segments so nested branch identity stays stable.

## Intended Reachability Use

Once region collection exists, reachability should:

1. compute stylesheet availability for component/root contexts as it does today
2. map that availability onto collected render regions
3. preserve `possible` for branch-local regions under uncertain render paths
4. let selector-analysis prefer region-level contexts over only subtree-root contexts

## Important Constraint

This should stay bounded.

The collector is not trying to create a full execution-path lattice.
It is only trying to give the engine a stable identity for branch-local parts of the render IR so reachability can stop flattening everything to one component root.

## Immediate Implementation Slice

The first implementation slice should be:

1. add `RenderRegion` types to the render-IR layer
2. add a collector that walks `RenderSubtree[]`
3. export that collector
4. add targeted unit tests for conditional and repeated-region collection

Only after that should reachability start consuming the new region records.
