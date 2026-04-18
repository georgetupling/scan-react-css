# Static Analysis Engine Core IRs And Type Shapes

## Purpose

This document defines the first proposed set of core intermediate representations, or IRs, for the static-analysis-engine track.

The goal is to answer:

- what are the main internal data shapes of the new engine?
- what problem does each shape solve?
- how do the IRs connect to one another?
- what level of detail should each stage preserve?

This is an architectural design document, not a final implementation contract.

It should give the project a stable conceptual model for early implementation without pretending every field is final.

## Why this document matters

The new engine will need to reason across several different domains at once:

- modules and imports
- symbols and bindings
- values and helper results
- React component composition
- approximate rendered element structure
- CSS selectors and their matching constraints

If every stage keeps working directly on raw TypeScript AST nodes plus ad hoc helper objects, the system will become hard to extend and hard to debug.

The purpose of IRs is to normalize those concerns into more manageable structures.

Plain-language summary:

- raw ASTs are good for parsing
- IRs are good for reasoning

## What an IR is

An intermediate representation is simply an internal data structure designed to support a particular stage of analysis.

In this project, an IR should:

- preserve the important meaning of the source
- remove irrelevant syntax noise
- make uncertainty explicit
- make later analysis stages easier to implement

The engine will likely use multiple IRs, not one universal structure.

That is intentional.

Each IR exists because different questions need different views of the same codebase.

## Design Principles

The core IRs should follow these principles.

### 1. Normalize early, but not too early

Each IR should simplify the source enough to support reasoning.

But it should not throw away information that later stages need for explanation or debugging.

### 2. Preserve uncertainty explicitly

The IRs should prefer:

- definite
- possible
- unknown

over pretending everything is fully known.

### 3. Separate concerns

Each IR should answer one main kind of question.

Examples:

- module relationships
- symbol resolution
- abstract values
- rendered structure
- selector constraints

### 4. Keep explanation paths available

The engine should be able to explain why it reached a conclusion.

That means IR nodes should usually retain enough provenance to trace back to:

- source file
- source range
- originating symbol
- originating expression

### 5. Avoid one giant "everything node"

A giant universal node type would be flexible in theory but messy in practice.

The engine should instead use several linked IRs with clear boundaries.

## Proposed IR Stack

The initial recommended IR stack is:

1. module graph IR
2. symbol IR
3. abstract value IR
4. render graph IR
5. render subtree IR
6. selector constraint IR
7. explanation trace shapes

This is not the only possible stack, but it is a reasonable first decomposition.

## 1. Module Graph IR

## Purpose

The module graph IR answers:

- what files/modules exist?
- what imports and exports connect them?
- which modules define components, helpers, and values?

This IR is the structural foundation for everything else.

## Plain-language explanation

Before the engine can reason about React behavior, it needs to know the codebase-level map.

That map is the module graph.

It is not about rendered output yet.
It is about source-level relationships.

## Proposed shape

```ts
type EngineModuleId = string;
type EngineSymbolId = string;

type ModuleGraph = {
  modulesById: Map<EngineModuleId, ModuleNode>;
  importEdges: ModuleImportEdge[];
  exportEdges: ModuleExportEdge[];
};

type ModuleNode = {
  id: EngineModuleId;
  filePath: string;
  kind: "source" | "css" | "external-css";
  imports: ModuleImportRecord[];
  exports: ModuleExportRecord[];
  topLevelSymbols: EngineSymbolId[];
};

type ModuleImportRecord = {
  specifier: string;
  resolvedModuleId?: EngineModuleId;
  importKind:
    | "source"
    | "css"
    | "external-css"
    | "type-only"
    | "unknown";
  importedNames: Array<{
    importedName: string;
    localName: string;
  }>;
};

type ModuleExportRecord = {
  exportedName: string;
  localSymbolId?: EngineSymbolId;
  reexportedModuleId?: EngineModuleId;
};

type ModuleImportEdge = {
  fromModuleId: EngineModuleId;
  toModuleId: EngineModuleId;
  kind: ModuleImportRecord["importKind"];
};

type ModuleExportEdge = {
  fromModuleId: EngineModuleId;
  toModuleId: EngineModuleId;
  exportedName: string;
};
```

## Notes

- Module graph nodes should stay lightweight.
- This IR should not attempt to encode rendered structure.
- CSS modules and external CSS can still appear here as module-like resources, because they participate in import structure.

## 2. Symbol IR

## Purpose

The symbol IR answers:

- what named thing does this identifier refer to?
- is it local, imported, re-exported, unresolved, or synthetic?
- is it a component, helper, constant, or something else?

## Plain-language explanation

The module graph tells us which files connect.

The symbol IR tells us what names inside those files mean.

Without this, the engine cannot confidently answer:

- what `Button` means here
- whether `joinClasses` is a helper we can summarize
- whether `variantMap` is local or imported

## Proposed shape

```ts
type SymbolKind =
  | "component"
  | "function"
  | "constant"
  | "variable"
  | "prop"
  | "imported-binding"
  | "css-resource"
  | "unknown";

type EngineSymbol = {
  id: EngineSymbolId;
  moduleId: EngineModuleId;
  kind: SymbolKind;
  localName: string;
  exportedNames: string[];
  declaration: SourceAnchor;
  resolution:
    | { kind: "local" }
    | { kind: "imported"; targetSymbolId?: EngineSymbolId; targetModuleId?: EngineModuleId }
    | { kind: "synthetic" }
    | { kind: "unresolved"; reason: string };
  metadata?: Record<string, unknown>;
};

type SourceAnchor = {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine?: number;
  endColumn?: number;
};
```

## Notes

- Symbols should be stable IDs, not just raw names.
- The engine should be able to attach later analysis summaries to symbols without changing the core identity model.
- A component definition is a special kind of symbol, not necessarily a separate top-level graph node.

## 3. Abstract Value IR

## Purpose

The abstract value IR answers:

- what value might this expression represent?
- what is definite, what is possible, and what is unknown?

## Plain-language explanation

The engine cannot usually know the exact runtime value.

Instead, it needs a compile-time approximation.

For example:

- exact string `"button"`
- set of possible strings `["button--primary", "button--ghost"]`
- object with known shape
- subtree payload
- unknown because the logic is too dynamic

That is what the abstract value IR is for.

## Proposed shape

```ts
type AbstractValue =
  | { kind: "unknown"; reason: string }
  | { kind: "null" }
  | { kind: "boolean"; value?: boolean }
  | { kind: "number"; value?: number }
  | { kind: "string-exact"; value: string }
  | { kind: "string-set"; values: string[] }
  | { kind: "string-fragments"; fragments: AbstractStringFragment[] }
  | { kind: "array"; items: AbstractValue[]; isComplete: boolean }
  | { kind: "object"; properties: Record<string, AbstractValue>; hasUnknownProperties: boolean }
  | { kind: "jsx-subtree"; subtree: RenderSubtreeValue }
  | { kind: "function-summary"; summaryId: string }
  | { kind: "union"; variants: AbstractValue[] };

type AbstractStringFragment =
  | { kind: "literal"; value: string }
  | { kind: "unknown"; reason: string }
  | { kind: "string-set"; values: string[] };
```

## Notes

- A union is useful when several branches are possible.
- A string-fragment representation helps with template literals before collapsing to pure `unknown`.
- This IR should remain language-agnostic enough that later stages can consume it without caring about raw TS syntax.

## 4. Abstract Class Set IR

## Purpose

The engine needs a more specific representation for class values than generic strings.

This IR answers:

- which classes are definitely applied?
- which classes are possibly applied?
- what class information is still unknown?

## Proposed shape

```ts
type AbstractClassSet = {
  definite: string[];
  possible: string[];
  mutuallyExclusiveGroups: string[][];
  unknownDynamic: boolean;
  derivedFrom: ClassDerivationStep[];
};

type ClassDerivationStep = {
  sourceAnchor?: SourceAnchor;
  description: string;
};
```

## Notes

- This is not a replacement for `AbstractValue`.
- It is a specialized derivative IR built from abstract values when the engine is specifically reasoning about class-bearing expressions.
- The `derivedFrom` field is an example of trace-friendly provenance.

## 5. Render Graph IR

## Purpose

The render graph answers:

- which components render which other components?
- what possible composition paths exist between components?

## Plain-language explanation

This is the component-to-component graph.

It is not yet a DOM tree.
It is the map of component composition relationships.

## Proposed shape

```ts
type RenderGraph = {
  componentNodesById: Map<EngineSymbolId, RenderComponentNode>;
  renderEdges: RenderEdge[];
};

type RenderComponentNode = {
  componentSymbolId: EngineSymbolId;
  moduleId: EngineModuleId;
  declaration: SourceAnchor;
  entryKind: "function-component" | "arrow-component" | "class-component" | "unknown";
};

type RenderEdge = {
  fromComponentSymbolId: EngineSymbolId;
  toComponentSymbolId: EngineSymbolId;
  callSite: SourceAnchor;
  propBindings: PropBindingSummary[];
};

type PropBindingSummary = {
  propName: string;
  value: AbstractValue;
};
```

## Notes

- The render graph should stay at component-composition level.
- It should not try to model element nesting directly.
- Prop summaries on edges are important because component composition alone is not enough for real reasoning.

## 6. Render Subtree IR

## Purpose

The render subtree IR answers:

- what approximate rendered structure can this component or JSX expression produce?

This is the engine's closest approximation to rendered HTML.

## Plain-language explanation

This is where the analysis stops being "graph of files and components" and starts being "approximate tree of rendered things."

This IR should preserve:

- parent/child relationships
- inserted subtrees
- conditionals
- uncertainty

## Proposed shape

```ts
type RenderSubtreeValue = {
  rootNodes: RenderNode[];
  certainty: "definite" | "possible";
};

type RenderNode =
  | RenderElementNode
  | RenderFragmentNode
  | RenderComponentCallNode
  | RenderConditionalNode
  | RenderSlotNode
  | RenderUnknownNode;

type RenderElementNode = {
  kind: "element";
  tagName: string | "unknown";
  classes: AbstractClassSet;
  attributes: Record<string, AbstractValue>;
  children: RenderNode[];
  sourceAnchor: SourceAnchor;
};

type RenderFragmentNode = {
  kind: "fragment";
  children: RenderNode[];
  sourceAnchor: SourceAnchor;
};

type RenderComponentCallNode = {
  kind: "component-call";
  targetComponentSymbolId?: EngineSymbolId;
  props: Record<string, AbstractValue>;
  expandedChildren?: RenderNode[];
  sourceAnchor: SourceAnchor;
};

type RenderConditionalNode = {
  kind: "conditional";
  branches: RenderBranch[];
  sourceAnchor: SourceAnchor;
};

type RenderBranch = {
  guard: AbstractValue;
  children: RenderNode[];
  certainty: "definite" | "possible";
};

type RenderSlotNode = {
  kind: "slot";
  slotName: string;
  content: RenderNode[] | "unknown";
  sourceAnchor: SourceAnchor;
};

type RenderUnknownNode = {
  kind: "unknown";
  reason: string;
  sourceAnchor?: SourceAnchor;
};
```

## Notes

- `RenderComponentCallNode` is useful even if later stages inline some of these calls.
- `RenderSlotNode` makes `children` and named subtree props explicit rather than encoding them indirectly.
- `RenderConditionalNode` should preserve branch-level uncertainty.

## 7. Selector Constraint IR

## Purpose

The selector constraint IR answers:

- what conditions must hold for this selector branch to match?

## Plain-language explanation

A CSS selector is easier to reason about once it is transformed into match constraints.

Examples:

- `.a.b` means the same node needs both classes
- `.scope .item` means some ancestor needs `scope` and the subject needs `item`
- `.toolbar > .button` means the direct parent needs `toolbar`

## Proposed shape

```ts
type SelectorConstraint =
  | SameNodeConstraint
  | AncestorDescendantConstraint
  | ParentChildConstraint
  | UnsupportedSelectorConstraint;

type SameNodeConstraint = {
  kind: "same-node";
  requiredClasses: string[];
  forbiddenClasses: string[];
};

type AncestorDescendantConstraint = {
  kind: "ancestor-descendant";
  ancestorRequiredClasses: string[];
  subjectRequiredClasses: string[];
};

type ParentChildConstraint = {
  kind: "parent-child";
  parentRequiredClasses: string[];
  childRequiredClasses: string[];
};

type UnsupportedSelectorConstraint = {
  kind: "unsupported";
  selectorText: string;
  reason: string;
};

type SelectorBranchIR = {
  rawSelector: string;
  sourceFilePath: string;
  line: number;
  atRuleContext: Array<{ name: string; params: string }>;
  constraint: SelectorConstraint;
};
```

## Notes

- The first version should support only a bounded subset of selector shapes.
- Unsupported selectors should be explicit rather than silently flattened into misleading approximations.

## 8. Reachability IR

## Purpose

The new engine still needs to track stylesheet availability.

This IR answers:

- where can this stylesheet be considered available?
- under what component or route contexts?

## Proposed shape

```ts
type ReachabilitySummary = {
  cssResourceId: string;
  availability: ReachabilityAvailability[];
};

type ReachabilityAvailability = {
  contextKind: "module" | "component" | "route" | "render-path";
  contextId: string;
  certainty: "definite" | "possible";
};
```

## Notes

- This is intentionally more flexible than the current file-level reachability map.
- The exact contexts can evolve, but the new engine should avoid collapsing everything back to plain source-file paths.

## 9. Explanation Trace Shapes

## Purpose

The engine must be explainable.

This IR answers:

- why did the engine resolve a symbol this way?
- why is this class definite or possible?
- why was this selector considered satisfiable or unsupported?

## Proposed shape

```ts
type AnalysisTrace = {
  traceId: string;
  category:
    | "symbol-resolution"
    | "value-evaluation"
    | "class-derivation"
    | "render-expansion"
    | "selector-match"
    | "reachability";
  summary: string;
  anchor?: SourceAnchor;
  children: AnalysisTrace[];
  metadata?: Record<string, unknown>;
};
```

## Notes

- The first implementation does not need a fully polished explanation UI.
- But it should preserve enough structure that deeper explanations can be added later without redesigning every stage.

## Relationship Between The IRs

These IRs are linked, not isolated.

The intended flow is roughly:

1. Parse source into module graph candidates.
2. Resolve symbols over the module graph.
3. Evaluate values into abstract values.
4. Derive class sets and prop summaries from abstract values.
5. Build the render graph.
6. Build render subtree IR from components and prop flow.
7. Parse CSS selectors into selector constraint IR.
8. Evaluate selector satisfiability using:
   - render subtree IR
   - selector constraint IR
   - reachability IR
9. Emit findings and traces.

## What Should Stay Out Of The Core IRs

To keep the design disciplined, the following should not be baked into the core IR layer too early:

- CLI formatting concerns
- final user-facing summary strings
- rule-specific quirks
- ad hoc migration hacks from the current scanner
- framework-specific assumptions unless explicitly modeled

Core IRs should stay general enough to support multiple rules and experiments.

## Minimal First Implementation Recommendation

The project does not need to build every IR fully before writing any code.

A good first practical subset would be:

1. module graph IR
2. symbol IR
3. abstract value IR
4. abstract class set IR

That subset is enough to start:

- bounded symbol resolution
- class-oriented value evaluation
- early experiments with prop flow

The next likely step after that would be:

5. render graph IR
6. render subtree IR

Only after that should selector constraint IR become central.

## Stability Guidance

These IRs should be treated as early but serious contracts.

That means:

- names may still change
- some fields may still move
- some node kinds may still split or merge

But the broad decomposition should stay relatively stable unless strong evidence suggests otherwise.

Changing these structures frequently without updating the surrounding docs will make the new engine hard to reason about.

## Definition Of Done For This Design Step

This design step is done when:

- the project has a shared vocabulary for the main IRs
- each IR has a clearly stated purpose
- the likely relationships between IRs are documented
- contributors can begin implementing the first new-engine types without inventing the conceptual model from scratch

## Recommendation

Treat the core IR stack in this document as the initial backbone of the static-analysis-engine track.

The first implementation work should focus on:

- module graph IR
- symbol IR
- abstract value IR
- abstract class set IR

Those are the smallest set of structures that meaningfully move the project from:

- file-and-token analysis

toward:

- bounded program and render reasoning
