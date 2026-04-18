# Render Structure Analysis Note

## Purpose

This note describes a future direction for `scan-react-css`: adding a richer static analysis layer that approximates rendered React structure closely enough to answer selector questions that are currently out of scope.

The motivating examples are things like:

- ancestor-qualified selectors such as `.page .title`
- parent-child selectors such as `.toolbar > .button`
- wrapper and slot patterns where CSS is imported in one component but the matching markup is provided by another
- questions like "can this selector actually match any rendered element?"

This is intentionally a future-work note, not near-term implementation guidance.

It represents a much larger system than the current file-level CSS reachability model.

## Why this idea comes up

The current scanner is good at questions like:

- does this source file reference class `x`?
- does project CSS define class `x`?
- is the stylesheet containing `x` reachable from this source file through imports, globals, or known render ancestry?

Those are valuable and tractable questions.

But some CSS only makes sense with structural context.

Example:

```css
.topic-manage-page .topic-manage-page__title-skeleton {
  width: min(16rem, 100%);
}
```

The scanner can already see:

- the class `topic-manage-page`
- the class `topic-manage-page__title-skeleton`
- the file that imports the CSS

What it cannot currently prove is:

- whether an element with `topic-manage-page__title-skeleton`
- is rendered inside
- an ancestor element with `topic-manage-page`

That is a different kind of problem.

It is not mainly about CSS-file reachability.
It is about approximate rendered structure.

## Plain-language summary

If this direction were pursued, the scanner would stop being "just" a file-and-class analyzer.

It would start building a rough model of:

- which React components render which other components
- which JSX elements are nested inside which other elements
- which classes can land on which elements
- which CSS selectors can plausibly match those elements

This is a static analysis engine because it tries to infer runtime-like behavior from source code without actually executing the app.

## A quick vocabulary guide

These terms can sound more intimidating than they are, so it helps to define them early.

### Static analysis

Static analysis means reasoning about program behavior by reading source code rather than running it.

In this project, the scanner is already doing static analysis when it:

- parses React source
- extracts class names
- follows imports
- computes stylesheet reachability

### Approximation

Approximation means deliberately accepting that the model will not be perfect.

For example:

- a conditional render may produce one subtree or another
- a prop may or may not be passed
- a helper may build multiple possible class strings

The engine would not try to know the one true runtime output.
It would try to build a safe and useful approximation of possible outputs.

### Intermediate representation

An intermediate representation, often shortened to IR, is just a normalized internal data structure.

Instead of working directly on raw TypeScript AST nodes forever, the engine would translate code into simpler objects that are easier to reason about.

Think:

- "element with these classes and these children"

instead of:

- "a complicated nested TypeScript JSX AST node"

### Abstract interpretation

This is a formal-sounding term for a practical idea:

- represent runtime values with simplified compile-time summaries

For example, instead of trying to know the exact runtime class string, the engine might store:

- definite classes
- possible classes
- unknown dynamic residue

That is an abstract value.

## What the current engine does well

The current architecture already has some strong foundations:

- source parsing
- class extraction
- CSS parsing
- project model construction
- file-level reachability
- rule execution over a normalized model

That means a future render-structure engine would not start from zero.

However, it would add a new analysis dimension rather than a small extension to the existing one.

## What this future engine would try to answer

It would aim to answer questions like:

- can selector `.scope .item` match any known rendered element?
- can selector `.toolbar > .button` match under any known render path?
- does component `A` render markup that can satisfy CSS imported by component `B`?
- does a passed `children` or `slot` subtree contain elements that satisfy wrapper-owned CSS selectors?
- is a contextual selector branch likely dead because the required structure never appears?

These questions all depend on rendered structure, not just class token presence.

## Why this is harder than file-level reachability

File-level reachability asks:

- is stylesheet `X.css` reachable from source file `Y.tsx`?

Rendered-structure analysis asks:

- can some concrete rendered element produced by `Y.tsx` or its children satisfy selector `X` under any known render path?

That requires reasoning about:

- nested JSX
- component calls
- props
- `children`
- fragments
- conditionals
- list rendering
- helper-produced classes
- cross-file composition

This is a much larger search space.

## The likely architecture layers

The cleanest design would probably use several linked layers rather than one giant graph.

Each layer answers a different kind of question.

### 1. Module and symbol graph

This is the "what is defined where?" layer.

It would track things like:

- modules
- imports and exports
- component definitions
- constants
- helper functions

Why this matters:

- if component `Page` imports `Card`
- and `Card` imports `Card.css`
- the engine needs to know those relationships before it can reason about rendered structure

### 2. Render graph

This is the "which components render which other components?" layer.

It would include edges like:

- `Page` renders `Card`
- `Card` renders `Button`

This is still not DOM structure.
It is component composition structure.

Why this matters:

- it tells us where rendered subtrees can flow through the app

### 3. Element tree intermediate representation

This is where the engine starts to look like approximate rendered HTML.

Each node in this IR would represent something like:

- an intrinsic element such as `div` or `button`
- a fragment
- a component call
- a conditional branch
- a slot or `children` insertion point
- an unknown region

This IR is important because JSX ASTs are too low-level and awkward for repeated reasoning.

### 4. Abstract class-value model

Each element node would need a class model.

Not a single final string, but something more like:

- definite classes
- possible classes
- mutually exclusive variants
- unknown dynamic residue

Example:

```tsx
<div className={isOpen ? "panel is-open" : "panel"} />
```

A useful abstract class model might be:

- definite: `panel`
- possible: `is-open`

That is enough to power many useful approximations.

### 5. Selector constraint model

Selectors would also need to be represented in normalized form.

For example:

- `.a.b` becomes "same element must have `a` and `b`"
- `.scope .item` becomes "some ancestor must have `scope`, subject must have `item`"
- `.toolbar > .button` becomes "direct parent must have `toolbar`, child must have `button`"

This normalized selector form is what the engine would try to match against the element-tree IR.

### 6. Reachability and route context layer

The current scanner already has a reachability model.

A future engine would likely keep that, but it would need to attach reachability to richer structures such as:

- component subtrees
- element nodes
- route or render contexts

This is how the engine would connect:

- "could the selector match?"

with:

- "is the stylesheet even available there?"

## What the graph nodes probably are

If this system were implemented, the graph would likely contain several node kinds rather than only "HTML primitives."

Likely node families:

- `module`
- `symbol`
- `component`
- `render-call`
- `element`
- `fragment`
- `conditional`
- `slot`
- `css-selector-branch`

The important insight is:

- the engine would not be one tree
- it would be a multi-layer graph with some tree-like structures inside it

## What the edges probably mean

Likely edge kinds:

- imports
- exports
- renders
- contains-child
- passes-prop
- provides-children
- inserts-slot-content
- applies-class
- stylesheet-reachable
- selector-may-match

These edges would connect different parts of the system.

## A plausible element-tree IR

One practical internal representation might look roughly like this:

```ts
type AbstractClassSet = {
  definite: string[];
  possible: string[];
  unknownDynamic: boolean;
};

type RenderNode =
  | {
      kind: "element";
      tag: string | "unknown";
      classes: AbstractClassSet;
      children: RenderNode[];
    }
  | {
      kind: "component-call";
      componentId: string;
      props: Record<string, unknown>;
    }
  | {
      kind: "fragment";
      children: RenderNode[];
    }
  | {
      kind: "conditional";
      branches: RenderNode[][];
    }
  | {
      kind: "slot";
      name: string;
      content: RenderNode[] | "unknown";
    }
  | {
      kind: "unknown";
      reason: string;
    };
```

This is only a sketch, not a recommendation to implement it exactly as written.

The important part is the shape:

- normalized nodes
- explicit uncertainty
- preserved parent/child structure

## A plausible selector-constraint IR

Selectors would also benefit from a normalized representation.

For example:

```ts
type SelectorConstraint =
  | {
      kind: "same-node";
      requiredClasses: string[];
    }
  | {
      kind: "ancestor-descendant";
      ancestorClasses: string[];
      subjectClasses: string[];
    }
  | {
      kind: "parent-child";
      parentClasses: string[];
      childClasses: string[];
    };
```

Again, this is an illustration.

The point is that matching selectors against rendered structure is much easier when both sides are normalized.

## Where `children` and slots make things difficult

Wrapper and slot patterns are a major reason this becomes a real static-analysis subsystem.

Example:

```tsx
<BrowseToolbar
  search={<form className="browse-search-form" />}
/>
```

The wrapper component owns the CSS import.
The parent component owns the actual JSX subtree.

To reason about that, the engine needs to understand:

- wrapper component boundaries
- prop passing
- subtree insertion into wrapper output

That is far beyond simple file-level reachability.

## Why loops and conditionals are hard

React components do not produce a single fixed tree.

They often produce:

- one subtree or another
- zero or many repeated children
- optional wrapper layers
- different class sets in different branches

A practical engine would need to represent these possibilities without exploding into a giant number of cases.

That is why a bounded abstract model is important.

## Bounding the analysis

If this system were ever built, it should not try to model everything.

It would need explicit limits such as:

- maximum component-inline depth
- maximum cross-file hop count
- maximum selector complexity to analyze
- maximum branch count before collapsing to `unknown`
- maximum slot-propagation depth

Without these limits, performance and debuggability would likely become unacceptable.

## What this engine could improve

A bounded render-structure engine could potentially improve:

- ancestor-qualified selector handling
- parent-child selector handling
- wrapper/slot CSS reachability
- dead contextual selector detection
- confidence modeling for structure-dependent CSS matches

It could also support future rules such as:

- `unused-contextual-selector-branch`
- `selector-never-satisfied`
- `slot-owned-css-not-backed-by-consumer-markup`

## What it still would not solve cleanly

Even a sophisticated static engine would still have hard limits.

It would still struggle with:

- heavy runtime data dependence
- mutation-driven render logic
- render props with arbitrary logic
- third-party helper semantics
- framework transforms not modeled by the engine
- highly dynamic class string construction
- CSS-in-JS systems with runtime-only behavior

So even this future engine would still be an approximation.

## Major risks

### 1. Complexity growth

This is not a small enhancement.

It creates a new subsystem with its own mental model, correctness boundaries, and maintenance cost.

### 2. Performance cost

Render expansion and selector matching can become expensive quickly, especially with branching and repeated composition.

### 3. Debuggability cost

Once results are based on several layers of approximation, it becomes harder to explain:

- why a selector was considered satisfiable
- why a rule was suppressed
- why a branch was considered dead

### 4. Product drift

The project may drift away from "focused CSS scanner" toward "general React static analysis engine."

That may be worth it eventually, but it is a significant product choice.

## Recommended staged exploration

If this direction is ever explored, it should be built in narrow stages.

### Stage 1: same-file element nesting only

Handle only:

- intrinsic JSX elements
- same-file parent/child nesting
- same-file class extraction

This stage would avoid component inlining entirely.

### Stage 2: same-file ancestor-qualified selector checks

Support simple cases such as:

- same source file
- directly imported CSS
- selector shape `.ancestor .child`
- both classes visible in the same JSX return tree

This would target the highest-ROI cases without a full subsystem jump.

### Stage 3: local component inlining

Allow limited expansion of simple same-file local components.

This would help with wrapper patterns that do not cross file boundaries.

### Stage 4: cross-file component render expansion

Expand through imported component calls under strict depth and complexity budgets.

This is where the engine starts to become meaningfully interprocedural.

### Stage 5: slot and `children` modeling

Add bounded propagation for wrapper-owned CSS and consumer-provided subtrees.

This is likely one of the highest-value but hardest stages.

### Stage 6: selector satisfiability rules

Only after the earlier stages are stable should the engine support more ambitious structure-sensitive rules.

## Recommendation

Treat this as a future subsystem, not as an extension of the current reachability code.

The likely clean product boundary is:

- current engine: file-level CSS reachability plus class token analysis
- future engine: render-structure analysis plus selector satisfiability

That separation matters because the future engine would carry different costs, risks, and explanatory needs.

## Relationship to maximal class source analysis

This note is closely related to [maximal-class-source-analysis-note.md](./maximal-class-source-analysis-note.md), but it is not the same thing.

That note is mainly about:

- tracing class values through JS and TS code

This note is mainly about:

- tracing rendered structure and selector satisfiability

In practice, the two directions reinforce each other.

If the engine cannot recover likely class values, render-structure analysis becomes weaker.
If it cannot recover approximate rendered structure, class-value analysis cannot answer selector questions on its own.

Together they describe a broader future direction:

- a much richer React and CSS static analysis engine

## Recommendation for now

Do not treat this as the next natural increment after current observation fixes.

The best near-term path is still:

- keep improving bounded class extraction
- keep improving file-level reachability
- add narrow targeted heuristics only where the payoff is unusually high

If the project eventually wants selector satisfiability, it should be pursued as an explicit second-system effort.

## Addendum: What A Full Static Analysis Engine Would Require

The main body of this note describes a future render-structure subsystem.

That is already a substantial step beyond the current scanner.

But there is an even larger version of this direction:

- a fuller static analysis engine that tries to model not just rendered structure
- but also the flow of values, props, helpers, and control-flow decisions that determine that structure

This section maps out what that larger system would require, what it would unlock in practice, and what tradeoffs come with it.

## Plain-language summary

A render-structure engine answers questions like:

- "what elements might be nested inside what other elements?"

A fuller static analysis engine tries to answer both:

- "what might be rendered?"
- "why might it be rendered that way?"

That means it needs to reason about:

- values flowing through variables
- props flowing into components
- helper function behavior
- branching logic
- imported constants and helpers across files
- possibly some bounded interprocedural evaluation

In plain language:

- the render-structure engine is about approximate output shape
- the full static analysis engine is about approximate program behavior that produces that shape

## What "full static analysis engine" means in this project

For this project, a full static analysis engine would likely mean a system that can, within strict limits:

1. Resolve symbols and imports across modules.
2. Evaluate a meaningful subset of JS and TS expressions.
3. Track props and value flow into JSX structure.
4. Track class construction through helpers and shared abstractions.
5. Build approximate rendered subtrees with uncertainty preserved.
6. Evaluate whether CSS selectors can match those approximate subtrees.

This does not mean "perfectly understand arbitrary JavaScript."

It means:

- build a bounded, useful, explainable approximation of enough program behavior to answer much richer CSS questions

## What extra subsystems it would require

Compared with the render-structure note above, a fuller engine would likely require the following additional subsystems.

### 1. Symbol resolution layer

The engine would need to answer questions like:

- what does `Button` refer to?
- what does `classes` refer to?
- where does `renderHeader` come from?
- is `variantMap.primary` a local object entry or an imported constant?

That means building a stronger symbol-resolution layer over the module graph.

Why this matters:

- without symbol resolution, the engine cannot reliably connect component calls, prop values, and helper-returned class strings across files

### 2. Abstract value system

The engine would need a richer value model than "string or unknown."

For example, instead of storing:

- `"button button--primary"`

it may need to store:

- definite class `button`
- one of `button--primary | button--ghost | button--danger`
- unknown dynamic residue

This kind of value model is often called a value lattice or abstract value system.

You do not need the formal term to use the idea.
The practical idea is:

- represent many possible runtime values in one compact compile-time object

### 3. Expression evaluator

The engine would need to interpret a broader subset of JS and TS:

- literals
- template literals
- arrays and objects
- property reads
- conditionals
- logical expressions
- simple loops or loop-like array transforms
- helper calls
- returns
- destructuring

The current scanner already does a bounded version of this for class expressions.

A full engine would extend that much further.

### 4. Prop-flow analysis

The engine would need to understand how values move through component calls.

Example:

```tsx
<Panel isOpen={isOpen} header={<Title />} />
```

Then inside `Panel`:

```tsx
<section className={isOpen ? "panel is-open" : "panel"}>
  <header>{header}</header>
</section>
```

To reason about structure and selector satisfaction, the engine needs to connect:

- prop source
- prop destination
- effect on classes
- effect on inserted subtrees

### 5. Function summarization

The engine would likely need summaries for helpers and components.

A summary is a compact description of what a function tends to do.

Examples:

- returns a class string with base `button` plus one of a known set of modifiers
- returns a subtree with one root `div` and optional `header`
- inserts `children` inside a wrapper element with class `panel`

Why this matters:

- repeatedly re-evaluating every helper or component body in full would be too expensive

### 6. Budgeting and truncation

A serious static engine needs explicit limits so it does not become unbounded.

Typical budgets might include:

- max recursion depth
- max number of unioned value variants
- max component-inline depth
- max render branches tracked
- max cross-file symbol hops
- max selector complexity

When the engine exceeds a budget, it should degrade gracefully to:

- possible
- unknown
- unsupported

rather than pretending to know more than it does.

### 7. Explanation and trace layer

The richer the engine becomes, the more important explanation becomes.

If the scanner says:

- selector `.panel .title` is satisfiable

users will want to know:

- where did that belief come from?
- which component path supported it?
- which classes were definite vs possible?

That means a future engine would likely need a trace or explanation layer, not just final findings.

## What it would unlock practically

This is the main question that determines whether the complexity is worth it.

A fuller engine could unlock several practical capabilities that the current scanner cannot approach cleanly.

### 1. Much stronger class-source tracing

It could recover class usage from patterns such as:

- imported constants
- variant maps
- helper wrappers
- object-driven class composition
- reusable style factories
- component prop combinations

Practical effect:

- fewer false positives for `missing-css-class`
- fewer false positives for `unused-css-class`
- fewer noisy dynamic-analysis findings

### 2. Better selector satisfiability checks

It could answer richer questions like:

- does `.page .title` ever match?
- does `.toolbar > .button` ever match?
- is `.card.is-selected` actually realizable?
- is `.slot-container .slot-item` satisfiable only through one specific wrapper path?

Practical effect:

- more accurate structure-sensitive findings
- new rules for dead contextual selectors
- better reasoning about wrapper-owned CSS

### 3. Better handling of `children`, slots, and subtree props

It could reason more concretely about:

- `children`
- JSX passed as props
- named slot props such as `header`, `footer`, `search`
- maybe render props under bounded conditions

Practical effect:

- far fewer false positives in wrapper-component patterns
- better reachability reasoning for CSS imported by layout or shell components

### 4. Better confidence modeling

A richer engine could say not just "yes" or "no," but:

- definite
- possible
- impossible under known render paths
- unknown because budget was exceeded

Practical effect:

- more honest and more actionable findings
- better severity/confidence separation
- clearer understanding of which findings are hard failures versus soft suspicions

### 5. New categories of rules

A fuller engine could support rule ideas that are hard or impossible today.

Examples:

- `selector-never-satisfied`
- `unused-contextual-selector-branch`
- `wrapper-css-not-backed-by-consumer-subtree`
- `prop-driven-class-variant-never-realized`
- `component-slot-markup-mismatch`
- `layout-selector-only-works-on-some-routes`

### 6. Better ownership analysis

Once the engine understands both structure and value flow better, it could make stronger ownership judgments.

Example questions:

- is this CSS effectively page-local?
- is it shared only through one wrapper?
- is this selector branch tied to one component state pattern and nowhere else?

Practical effect:

- ownership rules become more trustworthy and less guessy

## What extra confidence it would give us

This is one of the biggest reasons to consider the idea at all.

The engine would not just produce more answers.
It would produce stronger grounds for some answers.

### Areas where confidence could improve materially

#### Missing vs defined class questions

Today the scanner often knows:

- "I saw class `x` in React"
- "I saw class `x` in CSS"

A fuller engine could often know:

- "I saw class `x` flow through this helper and land on this element under these conditions"

That is much stronger evidence.

#### Reachability questions

Today reachability is mostly file-level.

A fuller engine could often know:

- "this selector is only satisfiable through these render paths"
- "this wrapper does provide the CSS and this subtree does land inside it"

That gives more confidence when suppressing false positives.

#### Dead selector questions

Today many structure-sensitive dead CSS questions are out of reach.

A fuller engine could sometimes say:

- "I cannot find any plausible render path where these selector constraints are all satisfied"

That is not perfect proof, but it is much stronger than today.

### Questions we could answer that we currently cannot

Examples of concrete questions the future engine could answer more directly:

- Can `.topic-manage-page .topic-manage-page__title-skeleton` match any rendered element in known code paths?
- Does `BrowseToolbar` ever receive slot markup containing `.browse-search-form`?
- Does `Field` ever wrap an element with `field__input` in a satisfiable way?
- Is `.panel.is-open` actually realizable under any known state path?
- Does this layout CSS only work when a specific wrapper is present?
- Does a selector require an ancestor structure that never appears?
- Is this prop-driven modifier class possible, definite, or dead?
- Does a component ever emit both classes required by a compound selector?
- Are two class variants mutually exclusive by construction?
- Is a contextual selector only satisfiable on some routes but not others?

These are all questions that are awkward, heuristic, or impossible under the current bounded model.

## What it would *not* magically solve

Even a large static engine would not become runtime truth.

There would still be important blind spots:

- user input
- fetched API data
- feature flags resolved elsewhere
- environment-specific branches
- complex custom hooks with opaque effects
- imperative DOM manipulation
- build-time transforms the engine does not model
- runtime styling systems
- highly dynamic render-prop patterns

So the confidence gain is real, but it would still be bounded confidence.

## What tradeoffs come with it

This is the most important balancing section.

### 1. Much higher implementation complexity

The engine would not be "one more parser helper."

It would be a major subsystem with:

- its own IR
- its own evaluator
- its own caches and budgets
- its own explanation model

That complexity would affect development velocity across the project.

### 2. Higher maintenance burden

Once the engine understands more JS, TS, JSX, and React patterns, users will naturally expect it to understand even more.

That creates a long tail of ongoing support:

- more helper shapes
- more React idioms
- more framework conventions
- more syntax cases

### 3. More performance pressure

Richer static analysis is usually more expensive.

Potential costs:

- more AST walking
- more graph expansion
- more cross-file reasoning
- more branching
- more memory use

The project would likely need:

- profiling
- aggressive caching
- strict truncation rules
- possibly per-stage timing instrumentation

### 4. Harder debugging for users

A simple finding like:

- `missing-css-class: "foo"`

is fairly easy to understand.

A richer finding like:

- "selector `.layout .button` is possibly unsatisfied under some inferred render paths"

may be more accurate, but also harder for users to interpret.

That means the project would need to invest more in:

- metadata
- explanations
- documentation
- maybe debug modes or traces

### 5. Greater risk of false confidence

This is subtle but important.

A richer engine can feel more authoritative than it really is.

That creates risk:

- if the engine is too conservative, it still misses useful cases
- if it is too aggressive, it may incorrectly suppress real problems

The deeper the analysis, the more dangerous silent overconfidence becomes.

### 6. Product identity drift

This is not just an implementation tradeoff.
It is a product tradeoff.

The project could drift from:

- "focused React CSS scanner"

toward:

- "general-purpose React static analysis engine with CSS as one application"

That may be valuable, but it changes:

- maintenance expectations
- onboarding burden
- performance expectations
- user mental model

## When a full engine would be worth it

This direction becomes more compelling if:

- false positives from abstraction-heavy code remain a major long-term pain point
- users repeatedly want structure-sensitive selector reasoning
- the project wants to add more semantic rules, not just more token-based rules
- performance budgets remain acceptable under bounded prototypes
- the team is willing to maintain a more advanced analysis subsystem over time

## When it would *not* be worth it

It is likely not worth it if:

- current bounded improvements solve most practical pain
- the remaining edge cases are narrow and can be handled with targeted heuristics
- project scope and maintenance simplicity matter more than maximum analytical power
- explainability and speed are more important than squeezing out every possible false positive

## A realistic adoption path

If this direction is ever pursued, the safest path would likely be:

1. Keep improving bounded class extraction.
2. Add narrow same-file structure reasoning.
3. Add minimal slot and wrapper reasoning where the payoff is obvious.
4. Prototype a small explanation layer.
5. Only then decide whether a broader static engine is justified.

That path would let the project measure:

- real accuracy gains
- performance cost
- debugging burden
- maintenance complexity

before committing to the full system.

## Recommendation

Treat the "full static analysis engine" idea as a strategic future path, not as an implementation detail of the current scanner.

Its biggest practical upside would be:

- fewer false positives in abstraction-heavy code
- stronger reasoning about wrapper and slot patterns
- the ability to answer selector-satisfiability questions the scanner currently cannot answer

Its biggest cost would be:

- turning a bounded CSS scanner into a much more general and expensive analysis system

That tradeoff may eventually be worth making.
It should just be made explicitly, with clear eyes, rather than reached accidentally through incremental complexity.
