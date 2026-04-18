# Static Analysis Engine Uncertainty And Decision Model

## Purpose

This document defines the uncertainty model for the static-analysis-engine track.

Its main goal is to prevent one of the most dangerous failure modes in the new engine:

- collapsing very different situations into one vague `possible` result

This matters because the new engine will often face two very different kinds of uncertainty:

1. semantic uncertainty
2. technical uncertainty

Those are not the same thing.

## The core product problem

When the engine says something is `possible`, what does that actually mean?

It could mean:

- the engine found a plausible render path or branch where the selector matches

or it could mean:

- the engine could not answer because it hit an unsupported pattern or a budget limit

Those lead to different product decisions.

Example:

- "possible because this selector matches on one branch but not another"

is a meaningful semantic result.

But:

- "possible because we could not analyze the render prop"

is not really a semantic result.
It is an analysis limitation.

If those are merged together, the engine becomes much harder to trust and much harder to debug.

## Design goals

The uncertainty model should satisfy the following goals.

### 1. Separate semantic conclusions from technical limits

The engine should not blur:

- "I found a plausible match"

with:

- "I could not answer"

### 2. Preserve useful nuance without becoming unusably complex

The model should be expressive enough to drive correct product decisions, but not so large that every stage becomes hard to implement.

### 3. Keep confidence separate from outcome

Confidence is not the same thing as uncertainty state.

For example:

- a result may be semantically `possible`
- but still be reached with high confidence under the bounded model

Or:

- a result may be `unsupported`
- which is not a confidence level at all

### 4. Support explanation

The model should make it easy to explain:

- what the engine concluded
- why it concluded that
- what stopped it from concluding more

## The main options

There are three realistic approaches.

## Option A: One flat enum

Example:

```ts
type AnalysisResult =
  | "definite"
  | "possible"
  | "unsupported"
  | "budget-exceeded"
  | "not-found";
```

### Advantages

- simple to implement
- easy to switch on in code
- easy to serialize

### Problems

- it tends to mix semantic outcomes and technical states into one bucket
- `possible` is still too overloaded
- `not-found` can be mistaken for proof rather than bounded absence
- later expansion becomes awkward because more nuance means more flat states

### Assessment

This is acceptable for a prototype, but too weak for the intended engine.

## Option B: Two-axis model

Separate:

- semantic outcome
- analysis status

Example:

```ts
type SemanticOutcome =
  | "match"
  | "possible-match"
  | "no-match-under-bounded-analysis";

type AnalysisStatus =
  | "resolved"
  | "unsupported"
  | "budget-exceeded";
```

### Advantages

- clearly separates semantic meaning from technical limits
- scales better than a single enum
- makes decision policy easier to reason about

### Problems

- not every combination is meaningful
- implementers need discipline about valid combinations
- some stages may feel slightly more verbose

### Assessment

This is strong and practical.

## Option C: Three-layer model

Separate:

1. semantic outcome
2. analysis status
3. confidence

Example:

```ts
type SemanticOutcome =
  | "match"
  | "possible-match"
  | "no-match-under-bounded-analysis";

type AnalysisStatus =
  | "resolved"
  | "partial"
  | "unsupported"
  | "budget-exceeded";

type Confidence = "high" | "medium" | "low";
```

### Advantages

- most expressive
- best for debugging and explanations
- keeps product policy and technical modeling cleanly separated

### Problems

- more fields to manage
- requires clearer contracts for each layer
- risks over-design if used carelessly

### Assessment

This is the best long-term model if kept disciplined.

## Recommendation

Use a structured model with:

- semantic outcome
- analysis status
- confidence

This is effectively Option C, with tight rules to keep it manageable.

The key idea is:

- semantic outcome answers "what did the engine conclude?"
- analysis status answers "how complete was the analysis?"
- confidence answers "how strongly should we trust the conclusion within the bounded model?"

## Recommended Model

## 1. Semantic outcome

This describes the analysis result in domain terms.

```ts
type SemanticOutcome =
  | "match"
  | "possible-match"
  | "no-match-under-bounded-analysis";
```

### Meaning

#### `match`

The engine found a satisfying structure under the supported bounded model.

This does not mean "runtime truth in all possible worlds."
It means:

- under the supported model, a satisfying path was found strongly enough to count as a match

#### `possible-match`

The engine found a plausible match path, but not one strong enough to treat as definite.

Examples:

- only some conditional branches match
- only some known routes match
- some class or structure requirements are possible rather than definite

This is semantic uncertainty, not technical failure.

#### `no-match-under-bounded-analysis`

The engine did not find a satisfying path within the supported bounded analysis.

This is intentionally worded carefully.

It does not mean:

- proven impossible at runtime

It means:

- under the current bounded model, no satisfying path was found

That distinction matters a lot.

## 2. Analysis status

This describes whether the engine reached its conclusion cleanly or with known technical limitations.

```ts
type AnalysisStatus =
  | "resolved"
  | "unsupported"
  | "budget-exceeded";
```

### Meaning

#### `resolved`

The engine reached the semantic outcome without hitting an unsupported feature or configured budget limit for the relevant reasoning path.

This is the healthy state.

#### `unsupported`

The engine could not fully analyze the case because the pattern is outside supported semantics.

Examples:

- unsupported render prop pattern
- unsupported helper shape
- unsupported selector feature

#### `budget-exceeded`

The engine intentionally stopped because it crossed a configured complexity budget.

Examples:

- too many branches
- too much recursive component expansion
- too many value variants

This is not the same as unsupported syntax.
It means the engine understands the pattern class in principle, but refused to continue because the local case became too expensive.

## 3. Confidence

Confidence remains separate from both of the above.

```ts
type Confidence = "high" | "medium" | "low";
```

### Meaning

Confidence describes how strongly the engine trusts the semantic outcome within the bounded model.

It should not be used to hide analysis limitations.

Examples:

- `possible-match` with `high` confidence can be valid if the engine confidently knows the selector matches on some but not all branches
- `unsupported` should not be softened into a low-confidence semantic answer if no real semantic answer was reached

## Recommended combined result shape

```ts
type AnalysisConclusion = {
  outcome: SemanticOutcome;
  status: AnalysisStatus;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};
```

This is the top-level conceptual shape, not necessarily the final exact implementation.

## Valid combinations

Not every combination is equally meaningful.

The engine should aim to keep the following combinations valid and common.

## Fully resolved results

```ts
{ outcome: "match", status: "resolved", confidence: "high" | "medium" }
{ outcome: "possible-match", status: "resolved", confidence: "medium" | "low" }
{ outcome: "no-match-under-bounded-analysis", status: "resolved", confidence: "high" | "medium" }
```

These are the most useful results because they reflect real bounded semantic conclusions.

## Technically limited results

```ts
{ outcome: "possible-match", status: "unsupported", confidence: "low" }
{ outcome: "possible-match", status: "budget-exceeded", confidence: "low" }
{ outcome: "no-match-under-bounded-analysis", status: "unsupported", confidence: "low" }
{ outcome: "no-match-under-bounded-analysis", status: "budget-exceeded", confidence: "low" }
```

These should be used carefully.

The important thing is that the technical status remains visible.

Product logic should not treat these the same way as resolved results.

## Combinations to avoid

The engine should avoid states like:

```ts
{ outcome: "match", status: "unsupported", confidence: "high" }
```

because that suggests the engine both failed to analyze the case and still reached a strong positive semantic conclusion.

Likewise:

```ts
{ outcome: "match", status: "budget-exceeded", confidence: "high" }
```

should be rare and carefully justified.

If the engine hits a technical limit, the result should usually become less strong, not more.

## Product decision rules

This is where the model becomes useful.

The engine needs not just states, but guidance on what those states mean for rule behavior.

## Recommended policy principles

### 1. Resolved semantic possibility is meaningful

If the engine returns:

- `outcome: "possible-match"`
- `status: "resolved"`

that should be treated as a real semantic result.

It may justify:

- suppressing a strong negative rule
- downgrading certainty
- emitting a lower-confidence advisory

### 2. Unsupported and budget-exceeded are analysis boundaries

If the engine returns:

- `status: "unsupported"`

or:

- `status: "budget-exceeded"`

then product logic should be cautious.

These should usually lead to:

- preserved warnings
- lower-confidence outputs
- debug metadata
- or separate technical diagnostics

They should not be treated as strong evidence that a selector or class is truly valid.

### 3. `no-match-under-bounded-analysis` is not a proof of impossibility

This outcome should be used carefully in messages and rule logic.

Good phrasing:

- no satisfying path was found under bounded analysis

Bad phrasing:

- this selector can never match

unless the engine later grows a much stronger proof system.

## Practical examples

## Example 1: semantic possibility

A selector matches only in one known conditional branch.

Recommended result:

```ts
{
  outcome: "possible-match",
  status: "resolved",
  confidence: "medium"
}
```

Meaning:

- the engine understands the structure
- it found a real plausible match
- but not across all paths

## Example 2: unsupported render prop

The engine encounters a render prop it does not model.

Recommended result:

```ts
{
  outcome: "possible-match",
  status: "unsupported",
  confidence: "low"
}
```

Meaning:

- we cannot rule the match out
- but this is because the engine is limited, not because a real semantic path was cleanly found

## Example 3: deep expansion budget exceeded

The engine stops after too many nested component expansions.

Recommended result:

```ts
{
  outcome: "no-match-under-bounded-analysis",
  status: "budget-exceeded",
  confidence: "low"
}
```

Meaning:

- no satisfying path was found before the budget limit
- the engine must not overclaim this as a reliable negative result

## Alternative model considered but rejected

The main rejected alternative is a single flat enum such as:

- `definite`
- `possible`
- `unsupported`
- `budget-exceeded`
- `not-found`

Reason for rejection:

- it is too easy to treat `possible` as a universal fallback bucket
- it makes product behavior harder to reason about
- it makes explanations less precise

## How this connects to the current scanner concepts

The current scanner already separates:

- severity
- confidence

The new engine should keep that separation.

But it also needs a new dimension:

- analysis status

because the richer engine will hit meaningful technical limits that must not be confused with semantic conclusions.

So the new engine effectively works with three different axes:

1. semantic outcome
2. analysis status
3. confidence

And later rule execution still adds:

4. severity

## Recommendation For Early Implementation

For the first implementation slice:

- adopt the structured model now
- keep the actual number of emitted combinations small
- prefer being explicit rather than clever

That means the early engine can start with these internal outcomes:

- `match/resolved`
- `possible-match/resolved`
- `no-match-under-bounded-analysis/resolved`
- `possible-match/unsupported`
- `no-match-under-bounded-analysis/budget-exceeded`

and expand only when the need is real.

## Definition Of Done For This Decision

This design step is done when:

- the project has a chosen uncertainty model
- semantic possibility and technical limits are clearly separated
- future implementation can use the model without debating what `possible` means each time

## Recommendation

Adopt the structured uncertainty model in this document as the default for the new engine.

In short:

- do not use one overloaded `possible`
- separate semantic outcome from technical status
- keep confidence separate from both

That gives the engine a clearer product story, safer rule decisions, and much better explanation behavior.
