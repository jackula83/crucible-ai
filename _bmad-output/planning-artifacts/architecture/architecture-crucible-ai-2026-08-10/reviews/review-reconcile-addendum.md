# Reconciliation Review — Spine vs PRD Addendum

- **Reviewed:** `ARCHITECTURE-SPINE.md` (draft, 2026-08-10)
- **Against:** `_bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/addendum.md`
- **Scope:** Report only what the spine dropped, contradicts, or silently weakened. Cross-language binding sketches treated as vision-level (spine owes only the portable contracts).
- **Verdict:** GAPS FOUND — no contradictions; one dropped decision and three silent weakenings/omissions, all minor-to-moderate.

## Decision-by-decision reconciliation

| Addendum decision | Spine coverage | Status |
| --- | --- | --- |
| Shell/schema split (deterministic shell + language-agnostic instruction schemas) | AD-1, AD-11, Design Paradigm | Covered |
| Porting cost = shell only; semantics written once | AD-1 rule ("changing judge behaviour must require no TS change"), AD-11 registry-ready frontmatter | Covered |
| Runs semantics: repetition wraps the whole test; assertion single-shot; re-arrange fresh per run; pass rate ≥ threshold | AD-3 (internal loop, one framework test), AD-4 (integer-safe threshold), AD-5 (fresh store per run) | Covered — AD-4's three-zone errored handling is a refinement consistent with FR-7, not a weakening |
| `runs` optional, omitted = 1 run (smoke mode, cheap CI lane) | **Nowhere** — AD-3, Conventions, and Capability Map never state a default or that `runs`/options are optional | **DROPPED (Finding 1)** |
| Parallel runs by default; serial fallback post-MVP | AD-3 (`Promise.all`), Deferred (serial execution) | Covered — but see Finding 4 on the dropped premise |
| Assertion surface: native boolean, no matchers, `toMeet` dropped, framework asserts / Crucible explains | AD-6, AD-10 | Covered |
| Verbosity: config default, env (`CRUCIBLE_VERBOSE`) wins; default = first judge error per failing run; full level; no file dumping | AD-9, AD-10 (adds a `debug` level — additive, fine) | Covered |
| Judge config: `crucible.config.json` at root; provider/model/`meta` passthrough; OpenRouter MVP; e2e on real provider; CI = GitHub Actions | AD-9, AD-8, AD-12, Deferred (per-provider docs page noted for provider #2) | Covered |
| Judge = agent executing instructions, not a hardcoded metric | AD-7 narrows to a single stateless completion | **Silently narrowed (Finding 2)** |
| Per-language binding sketches (xUnit attribute, JUnit annotation, pytest decorator) | Vision-level per task scope; portable contracts present: AD-5 names per-shell ambient-scope realizations, AD-6 boolean contract, AD-11 registry-ready schemas | Covered (as scoped) |
| Terminology rule: generic "state", never "world state"; domain-agnostic, Proscenium only as example | Spine text complies (zero occurrences of "world state"/"world log", verified by grep) but the rule itself is not codified anywhere | **Not carried forward (Finding 3)** |
| Design philosophy: state mutable within unit of work; stateless = degenerate case, no separate mode | AD-5 ambient per-run store; `load/append` available but not required; state = `string[]` append-only | Covered |
| Competitive rationale (semantic-expect citation, τ-bench pass^k vocabulary) | Docs/positioning material, not an architecture mechanism | Out of scope for spine |

## Findings

### Finding 1 — DROPPED: `runs` optional / smoke mode (moderate)

Addendum (Assertion surface section): "`runs` optional on `crucible.it()` — omitted = 1 run (smoke mode, cheap CI lane)."

The spine never records this. AD-3 says the runner "executes the body `runs` times"; the Consistency Conventions row for data & formats defines threshold and run status but no defaults; the Capability Map ties FR-1 to runner/aggregate without mention of the options object being optional. A reader implementing from the spine alone does not know the options bag can be omitted, what the default `runs` is, or that a cheap single-run CI lane is a decided product behavior (it interacts with AD-12's "zero provider traffic in CI" — smoke mode is the decided way to run semantic tests cheaply, distinct from unit tests). This is the only fully dropped decision.

**Fix:** add the default to AD-3's rule or the Conventions table: options optional; `runs` defaults to 1 (threshold semantics for the 1-run case: 1 of 1 must pass).

### Finding 2 — SILENTLY NARROWED: "judge = agent" became "single stateless completion" (minor)

Addendum: "Judge = agent executing instructions, not a hardcoded metric." AD-7: "Judge = single stateless completion" and explicitly *prevents* "multi-turn agent complexity."

Not a contradiction — one completion where the schema is the system prompt still satisfies "instructions define evaluation, not code," which is the load-bearing part of the addendum's decision. But the spine narrows the recorded decision without acknowledging it is doing so: nothing in AD-7 traces the narrowing back to the addendum's "agent" framing or notes that agentic evaluation (tool use, multi-step reading of large state) is deliberately excluded for MVP. If a schema ever needs more than one shot (e.g. long state exceeding context), this decision will be re-litigated without a record.

**Fix:** one sentence in AD-7 or Deferred: "Addendum's 'agent executing instructions' is realized as a single completion for MVP; multi-step/agentic judging is a deferred extension of the same schema contract."

### Finding 3 — NOT CARRIED FORWARD: terminology rule (minor)

Addendum terminology rule: docs use generic "state", never "world state"/"world log"; Proscenium appears only as an example; framework is domain-agnostic.

The spine *complies* (verified: zero occurrences) but does not codify the rule. The spine is the build substrate for downstream artifacts (epics, stories, docs, schema files, error messages, reporter output); none of those authors will see the addendum. The Consistency Conventions table is exactly where this belongs and it is absent.

**Fix:** add a Conventions row: "Terminology — generic 'state' everywhere (API, schemas, errors, docs); never 'world state'; no domain assumed."

### Finding 4 — WEAKENED: parallel-by-default premise dropped (minor)

Addendum: "Parallel runs by default — proper tests build a fresh isolated SUT per arrange, so runs don't share state."

AD-3 mandates `Promise.all` and AD-5 isolates *Crucible's* per-run store — but the addendum's justification rests on a user-side obligation: the test body must construct a fresh SUT per run for parallelism to be safe. The spine records the mechanism (parallel) while dropping the contract that makes it sound (re-entrant test bodies). Nothing in AD-3/AD-5 or the Conventions tells the user (or the docs author) that a body sharing a module-level SUT across runs is unsupported, nor does anything say whether Crucible detects/warns on it.

**Fix:** add the premise to AD-3's Prevents/Rule or Conventions: "Test bodies must be re-entrant — each run arranges its own SUT; shared mutable fixtures across runs are unsupported."

## Explicitly checked, no issue

- Rejected `{runs, threshold}` on the assertion: spine puts options on `crucible.it()` only; `coherent` takes `(response, claim)` — consistent.
- Pass-rate ≥ threshold vs AD-4 three-zone: refinement, not drift ( `⌈threshold × runs⌉` preserves the ≥ semantics integer-safely; errored-run handling implements FR-7, which the addendum's judge-config/runs sections presuppose).
- `meta` provider-specific passthrough: present verbatim in AD-9.
- Env-over-config precedence and its rationale scope: AD-10 matches.
- No file dumping: AD-10 "stdout only".
- `crucible` single namespace (renaming from `inferenceIt`): Conventions row, matches.
- Stateless-as-degenerate-case: no separate mode exists in the spine; state calls are optional within a run scope.
- OpenRouter MVP, e2e funded locally, GitHub Actions CI: AD-12.
