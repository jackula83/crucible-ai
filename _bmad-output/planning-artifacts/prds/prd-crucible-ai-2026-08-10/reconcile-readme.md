# Reconciliation — README.md vs PRD + Addendum

Input: `/Users/Jack/Development/crucible-ai/README.md` (original user input)
Against: `prd.md` + `addendum.md` (same directory)
Date: 2026-08-10

Scope note: the README's API sketch (`toMeet`, `coherence(claim, { runs, threshold })` at assertion level) is intentionally superseded by recorded decisions (test-level `inferenceIt` runs, boolean `coherent()` — see addendum "Runs semantics" and "Assertion surface"). Not treated as a gap here.

---

## G-1. Headline positioning shifted: "stateful systems" → "non-deterministic systems"

**README:** Line 3, the product's one-line identity: *"A semantic assertion library for **stateful systems**."*

**PRD:** Title and Vision reposition to *"Semantic Assertion Library for **Non-Deterministic Systems**"*. Statefulness is demoted from the product's identity to a design-philosophy paragraph ("stateless testing remains the degenerate case").

**Is a decision recorded?** Partially. The addendum's design-philosophy entry records "stateless testing = degenerate case: stateful capability supersets stateless; no separate mode" — that justifies *supporting* stateless use, but it does not record a decision to change the headline wedge. The README's competitive section argues the differentiator explicitly: state as first-class input is what promptfoo and DeepEval lack. The PRD keeps that argument in "Why Now" ("Nothing in the landscape treats system state as a first-class assertion input") — yet leads with non-determinism, which is the *category* (shared with every eval tool), not the *wedge* (unique to Crucible).

**Risk:** downstream artifacts (docs, npm description, launch copy) inherit the PRD title and market Crucible as "yet another LLM eval library" instead of "the one that treats state as first-class."

**Recommendation:** either restore state-first framing in the title/tagline (e.g. "semantic assertions for stateful, non-deterministic systems") or record an explicit positioning decision that the broader category framing is intended.

## G-2. Epistemic rationale dropped: "omniscience" and "what a character *should* know"

**README:** two connected ideas that together form the sharpest justification for state-first design:
- Line 9: Proscenium *"use a memory management technique to prevent omniscience, which is the #1 killer to long form storytelling."*
- Line 36: *"Crucible treats the world as a first-class input because that is the only way to express whether a character **should** know something."*

The README's canonical claim ("Jane won't find Bob...") is a *knowledge-boundary* assertion — it tests that the system does NOT know/use something it shouldn't — not merely a consistency check.

**PRD:** FR-5 frames `coherent()` purely as consistency ("semantically coherent with the claim given loaded state"). The glossary defines State as "facts the SUT's behaviour should respect." Nowhere does the epistemic dimension survive: asserting *absence* of knowledge (anti-omniscience) is the motivating use case and it is invisible in the FR structure. The addendum's terminology rule (de-Proscenium-ify vocabulary) explains dropping "world log," but the *generic* insight — inference systems fail by knowing too much, and state-scoped judging is how you test for it — is domain-agnostic and was lost with the Proscenium wrapper.

**Risk:** the instruction schema for `coherent` gets written to check "does response contradict state" and silently under-serves "does response reveal what it shouldn't" — the very case the founding example encodes.

**Recommendation:** add the epistemic angle to the Vision or FR-5 notes (one sentence), and consider a testable consequence: a response where Jane *does* find Bob must fail because it grants the SUT knowledge the state forbids.

## G-3. Competitor treatment: generous, philosophical voice flattened; one claim sharpened beyond the source

**README:** the Alternatives section has a distinct voice — respectful, specific, essayistic:
- *"the difference is **philosophical**"* (promptfoo isn't worse; it's a different theory of testing)
- promptfoo *"remains open source and the team committed to continuity"*; its roadmap *"is a real need and not this one"*
- DeepEval: *"G-Eval is a genuinely good primitive"*, the team is *"refreshingly direct"*, their TS-follows-Python call is *"a reasonable call for them and a bad fit for..."*

**PRD:** "Why Now" converts this to whitespace-hunting bullets and sharpens one claim beyond what the README supports: *"app-level semantic testing is nobody's priority there"* — the README says promptfoo committed to continuity and remains open source; "nobody's priority" is an inference, not the source's statement. The generosity ("real need, not this one", "reasonable call for them") and the "philosophical difference" framing are gone from both PRD and addendum (the addendum keeps only the mechanical "config-first vs code-first").

**Risk:** launch/docs positioning inherits the colder register and overclaims about promptfoo's abandonment of the space; the README's voice — confident builder who respects the neighbours — is part of the product's positioning and is not captured anywhere as guidance.

**Recommendation:** carry the README's competitor paragraphs (or a voice note: "generous, philosophical-difference framing; never dunk") into docs/positioning guidance — `research-landscape.md` citation in the addendum is data, not voice. Soften or evidence the "nobody's priority" line.

## G-4. State-from-SUT pattern lost: `crucible.load(story.getLogs())`

**README:** the arrange step loads state *harvested from the SUT itself* — `crucible.load(story.getLogs())`. State is the engine's own emitted log, produced by prior `sut.memory(...)` calls, not a hand-authored fixture. This is load-bearing for the "code-first ⇒ state is mutable within the unit of work" philosophy: the test drives the SUT, then hands the SUT's resulting state to the judge.

**PRD:** FR-3/FR-4 (`load(string | string[])`) technically permit this, but every journey and consequence describes developer-authored state ("arranges character/location facts as state", "With state 'Bob is at the casino; Jane is at home'"). The harvest-from-SUT pattern appears in no UJ, FR consequence, or docs-scope item.

**Not** part of the superseded API sketch — the supersession covers `toMeet`/assertion-level runs, not where state comes from.

**Risk:** docs and instruction schema get written assuming short hand-authored fact strings; real SUT logs (long, noisy, interleaved) are the actual dogfood input (Proscenium/SM-1) and may behave differently at judge time (context length, relevance extraction).

**Recommendation:** add the harvested-state variant to UJ-1 or FR-3 consequences, and note the judge must handle long/noisy SUT-emitted state, not just curated facts.

## G-5. Minor drops (record, low severity)

- **Origin story compression:** README's personal narrative ("I had trouble testing its inference capabilities") survives only as "Proscenium is the inspiration and first dogfood target." Acceptable for a PRD; note it for README-of-the-library/launch post, where the scratch-your-own-itch story is the hook.
- **"#1 killer" as a marketing hook:** independent of G-2's technical point, "omniscience is the #1 killer of long-form storytelling" is a memorable line worth keeping in docs aimed at the storytelling/NPC personas the PRD itself names as primary.
- **DeepEval timeline nuance:** README's "shipped a TypeScript SDK in July 2026, so the old 'Python-only' complaint is out of date" is a fairness qualifier; PRD's "TypeScript support explicitly trails" keeps the conclusion but drops the correction-of-stale-criticism framing. Fine for PRD; keep the qualifier in public-facing comparisons to preserve credibility.

## Contradictions checked, none found beyond the above

- Claim example preserved verbatim (FR-5).
- promptfoo acquisition date (March 2026) consistent.
- Jest/xUnit/JUnit deterministic-testing framing preserved (Vision).
- Code-first vs config-first contrast preserved (Vision, Non-Users, addendum).
- DeepEval TS-follows-Python conclusion preserved.
- G-1 is the only place the PRD *contradicts* README framing without a fully recorded decision; G-3's "nobody's priority" is a sharpening rather than a contradiction.

## Verdict

No fatal contradictions. Four substantive gaps, all qualitative: positioning wedge (G-1), epistemic use case (G-2), competitor voice (G-3), state-sourcing pattern (G-4). G-2 and G-4 can silently distort downstream implementation (instruction schema, docs); G-1 and G-3 distort downstream positioning. All fixable with one-line additions to prd.md or a recorded decision confirming the change was intended.
