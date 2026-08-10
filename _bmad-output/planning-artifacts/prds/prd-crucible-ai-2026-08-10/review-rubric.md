# PRD Quality Review — Crucible

Reviewed: `prd.md` + `addendum.md` (2026-08-10). Stakes calibration: OSS launch of a solo-built TypeScript developer library — rigor-light shape, substance bar unchanged.

## Overall verdict

This is a genuinely decision-dense PRD: the hard calls (test-level repetition over per-assertion runs, native boolean assertions over custom matchers, env-var-wins verbosity) are stated as decisions with rejected alternatives and named costs, and the scope discipline (one assertion, one provider, one binding) follows directly from the portability thesis. The main risk is done-ness at the edges: judge-call *error* semantics (as opposed to a false verdict) are undefined, which leaves FR-1's "a run passes iff every assertion passes" unimplementable without an invented rule. Everything else is at or above the bar for this stakes level.

## Decision-readiness — strong

Decisions are stated as decisions, with the losing option and its cost on the record. §Addendum "Runs semantics" explicitly rejects `{runs, threshold}` on the assertion because it "measures judge, not SUT"; §Addendum "Assertion surface" names the cost of dropping custom matchers ("native failure message is bare ('expected true')") and the mitigation. Open Questions are genuinely open — OQ-3 (rate limiting) and OQ-5 (schema versioning) have no smuggled answers — and OQ-1 honestly marks itself "partially resolved" rather than pretending closure. The single `[NOTE FOR PM]` (§6.2, Vitest) sits at a real tension, not a safe checkpoint.

### Findings
- **low** Per-test judge cost never sized (§4.4 NFR, §6.1) — "MVP e2e testing budget is a funded OpenRouter account" covers the builder, but a 20-run test is 20+ metered judge calls per execution, and adopters will hit this on day one. *Fix:* add a one-line order-of-magnitude cost expectation (or park it as an OQ feeding the docs plan).

## Substance over theater — strong

No furniture found. Personas (§2.1) are one paragraph and actually drive decisions — "my SUT is my own engine, instantiated in-process — not a prompt endpoint reachable by a YAML harness" is the load-bearing insight behind the code-first contract and the promptfoo differentiation. "Why Now" (§1) is dated, specific, and falsifiable (promptfoo acquisition March 2026, OpenAI Evals read-only October 2026, DeepEval TS lag) rather than trend-mongering. The NFRs that exist are product-specific (keys via env var so config stays committable; metered spend). Success Metrics are unusually honest: "builder is explicitly indifferent to adoption numbers" (§7) instead of invented targets.

## Strategic coherence — strong

The PRD has a clear thesis with two prongs — state as a first-class assertion input, and a portable instruction schema with per-language deterministic shells — and everything traces to it. MVP scope (§6) is a coherent problem-solving cut: one assertion "after `coherent` proves the schema shape," one provider, one binding. SM-C1 (§7) is a real counter-metric that names the failure mode ("chasing breadth before the `coherent` + schema shape is proven undermines the portability bet"), and SM-1 (dogfood in Proscenium's CI) validates the thesis rather than measuring activity. This does not read as a backlog with headings.

## Done-ness clarity — adequate

Most FRs carry at least one concretely testable consequence — FR-1's "executes its body 20 times and passes iff ≥ 19 runs pass," FR-5's Jane/Bob worked example, FR-6's "editing its instruction schema, with no change to TypeScript code" are exactly the right kind. But the error path is unspecified, and two FRs lack consequences entirely.

### Findings
- **high** Judge-call error semantics undefined (§4.4, FR-1/FR-5) — `coherent()` is specified only for verdicts (`true`/`false`). When the judge call itself fails (network error, timeout, provider 5xx — distinct from OQ-3's rate limiting), does the run count as failed, does the test error out, or is the run retried/excluded from the denominator? FR-1's "a run passes iff every assertion in its body passes" cannot be implemented — and pass rates cannot be trusted — without this rule. *Fix:* add a consequence to FR-5 (or a short error-semantics note in §4.4) defining verdict-vs-error behavior; fold retry policy into OQ-3 if still open.
- **medium** FR-4 (append state) has no Consequences block — the only FR with zero testable consequence; "subsequent assertions are judged against the accumulated state" lives in prose only. *Fix:* add e.g. "state appended after an act is visible to assertions after the append; assertions before the append were judged against pre-append state only."
- **low** FR-8 has no Consequences block and "a response excerpt" is unbounded (§4.5) — the description is specific about *what* prints (claim, excerpt, judge reasoning) but not verifiably so. *Fix:* one consequence naming excerpt bounds and confirming full response appears at `full` verbosity.

## Scope honesty — strong

Omissions are explicit at both levels: a substantive Non-Goals section (§5) that does real work (each entry names whose shape is being declined — "that is promptfoo's shape, not Crucible's") plus inline `[NON-GOAL for MVP]` callouts at every deferral point (FR-2 serial mode, FR-4 typed schemas, FR-5 future assertion types, §4.6 language shells). All four inline `[ASSUMPTION]` tags are indexed in §9. Open-items density (6 OQs, 4 assumptions, 1 PM note) is right for a pre-build solo PRD — none of the OQs blocks the green light, and the two that touch build decisions (OQ-1, OQ-3) are correctly scoped as implementation-time.

## Downstream usability — strong

Glossary (§3) is complete and used consistently — SUT, Claim, Run, Threshold, Instruction schema appear with identical meaning across §4, §6, and the addendum. FR-1..9, UJ-1..3, SM-1/2/C1, OQ-1..6 are contiguous and every cross-reference resolves (feature descriptions cite the UJs they realize; SM-1 cites FR-1..FR-9; assumptions cite OQs). `research-landscape.md` and `addendum.md` both exist in the workspace. One trap for the downstream architecture reader, noted in Mechanical: the addendum's opening example encodes the *rejected* API shape.

## Shape fit — strong

Correctly shaped as a capability spec for a developer library: one-line UJs explicitly flagged as such ("*Library product — journeys kept to one line each*", §2.3), FR-centric body, operational rather than vanity metrics, and mechanism depth pushed to the addendum instead of bloating the PRD. UJ protagonists are roles ("a storytelling-engine dev") rather than named individuals — acceptable at this stakes level and shape. Neither over- nor under-formalized.

## Mechanical notes

- **Addendum leads with the superseded API shape** — "Architecture direction" (addendum, first section) exemplifies `crucible.coherence('…', { runs: 20, threshold: 95 })`: per-assertion runs (rejected two sections later), `coherence` vs the PRD's `coherent`, threshold `95` vs the PRD's `0.95`, and "matchers like `toMeet`" (explicitly dropped). It is an honest historical snapshot, but it is the first thing a downstream architect reads. Suggest a one-line "superseded by 'Runs semantics' and 'Assertion surface' below" marker.
- Threshold scale drift: `0.95` (PRD, FR-1, addendum "Runs semantics") vs `95` (addendum "Architecture direction") — same issue as above; the 0–1 scale is the decided one.
- Assumptions Index roundtrip: clean. All four inline `[ASSUMPTION]` tags (title, FR-2, FR-9, §7) appear in §9; no index orphans.
- ID continuity: FR-1..9, UJ-1..3, SM-1/SM-2/SM-C1, OQ-1..6 — no gaps or duplicates; all cross-references resolve.
- Referenced files present: `addendum.md`, `research-landscape.md`.
