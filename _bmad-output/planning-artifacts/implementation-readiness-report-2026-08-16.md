---
stepsCompleted: [1, 2, 3, 4, 5, 6]
documentsIncluded:
  prd: prds/prd-crucible-ai-2026-08-10/prd.md
  prdAddendum: prds/prd-crucible-ai-2026-08-10/addendum.md
  architecture: architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md
  epics: epics.md
  ux: none
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-16
**Project:** crucible-ai

## Document Inventory

### PRD
- Folder: `prds/prd-crucible-ai-2026-08-10/`
  - `prd.md` (20KB, 2026-08-16) — main
  - `addendum.md` (6KB, 2026-08-10)
  - Supporting: `research-landscape.md`, `review-dx.md`, `review-rubric.md`, `reconcile-readme.md`

### Architecture
- Folder: `architecture/architecture-crucible-ai-2026-08-10/`
  - `ARCHITECTURE-SPINE.md` (17KB, 2026-08-16) — main
  - Supporting reviews: `review-adversary.md`, `review-currency.md`, `review-rubric.md`, `review-reconcile-prd.md`, `review-reconcile-addendum.md`

### Epics & Stories
- `epics.md` (26KB, 2026-08-16) — whole document

### UX Design
- None found

## Issues
- ⚠️ WARNING: No UX design document — UX alignment assessment will be incomplete
- No duplicate (whole + sharded) conflicts

## PRD Analysis

### Functional Requirements

- **FR-1: Declare an inference test** — Developer can declare a test with `crucible.it(name, { runs?, threshold? }, body)` alongside ordinary Jest tests in the same file. The runner lives on the `crucible` namespace, matching `crucible.load()` and `crucible.coherent()`; each language binding exposes the idiomatic equivalent. Testable consequences: `{ runs: 20, threshold: 0.95 }` executes body 20 times, passes iff ≥ 19 runs pass; integer-safe pass rule (passed runs ≥ ⌈threshold × runs⌉, never floating-point ratio comparison); omitting `runs` = smoke mode (1 run); a run passes iff every assertion in its body passes.
- **FR-2: Parallel run execution** — Runs of one inference test execute concurrently by default. Wall-clock bounded by slowest run + orchestration overhead. [ASSUMPTION: provider tolerates ≥20 concurrent judge calls — OQ-3.] Serial mode/concurrency limits out of scope for MVP.
- **FR-3: Load state** — Developer can load state via `crucible.load(string | string[])` during arrange. Loaded state available to every judge call by later assertions in same run; state scoped to the run even under parallel execution (concurrent runs never observe each other's state; mechanism = architecture decision OQ-7); hand-authored or harvested state treated identically.
- **FR-4: Append state** — Developer can append additional state after acts within same run; subsequent assertions judged against accumulated state; verdicts already returned unaffected.
- **FR-5: Coherence assertion** — Developer can call `crucible.coherent(response, claim)` and receive boolean verdict of semantic coherence with claim given loaded state. Stateless mode when no state loaded; knowledge-boundary (anti-omniscience) claims first-class.
- **FR-6: Instruction-schema-driven judging** — Each assertion type's evaluation procedure defined in a language-agnostic instruction schema the judge executes; TS library maps assertion calls to instruction sets. `coherent()` behaviour changes by editing schema, no TS code change.
- **FR-7: Provider configuration** — Provider, model, provider-specific `meta` passthrough in `crucible.config.json`; `meta` passed through unmodified. Unsupported provider fails fast at engine init with actionable error. Judge infrastructure failures (rate limit, timeout, 5xx) never recorded as semantic failures — run reported as *errored* with cause named. Retry/backoff: OQ-3.
- **FR-8: Actionable failure output** — On failure, prints pass rate vs threshold and per failing run: failing assertion's claim, response excerpt (bounded, [ASSUMPTION: ~500 char default cap, configurable]), judge reasoning (first error per run at default verbosity). Errored runs visually distinct from semantically failed runs.
- **FR-9: Verbosity ladder** — Output detail set in `crucible.config.json`, overridden per invocation via env var (env wins). Levels ≥: default (first error per failing run), full (all judge output per run), debug (engine init, execution, provider connection tracing). [ASSUMPTION: env var `CRUCIBLE_VERBOSE`.]

Total FRs: 9

### Non-Functional Requirements

PRD has no numbered NFR section; NFRs appear as feature-specific notes and constraints:

- **NFR-A (Cost/metering, §4.4):** Judge calls are metered spend; MVP e2e testing budget is a funded OpenRouter account. Judge cost scales linearly: one judge call per assertion per run.
- **NFR-B (Security/secrets, §4.4):** API keys supplied via environment variable, never in `crucible.config.json` — config stays committable. (Env var naming + CI-secret docs: OQ-1.)
- **NFR-C (Performance, §4.1/FR-2):** Parallel execution — wall-clock for N runs bounded by slowest run + overhead, not sum.
- **NFR-D (Reliability semantics, §4.1 notes):** Threshold is a sampled estimate (binomial noise); getting-started docs must include runs/threshold headroom guidance.
- **NFR-E (Portability, §4.6):** Deterministic shell language-specific; instruction schema written once, language-agnostic. MVP delivers TS/Jest shell; FR-6 validates the split.
- **NFR-F (CI, §6.1):** GitHub Actions — PR lane (lint, typecheck, unit; no provider traffic); main-merge lane additionally runs `e2e/core` against funded OpenRouter account; full e2e suite local via Makefile (manual, no pre-commit hook) per architecture AD-12.

Total NFRs: 6 (unnumbered in PRD, lettered here for traceability)

### Additional Requirements & Constraints

- Docs in MVP scope: getting started, config reference (OpenRouter page), instruction-schema explainer.
- Non-goals: no config-first eval matrices, no hosted service/dashboard/UI, no observability platform, no security/red-team eval, no prompt optimization, no custom matchers, no opinionated state schema.
- Out of MVP: additional assertion types, additional providers, other language shells/Vitest, serial/concurrency-limited execution, custom state-parsing instructions, judge-verdict caching.
- Open questions carried: OQ-1 (env var naming/CI-secret docs), OQ-3 (retry/backoff + rate limiting), OQ-4 (Vitest), OQ-5 (schema versioning), OQ-6 (judge model guidance), OQ-7 (state isolation mechanism).
- Success metrics: SM-1 dogfood (Proscenium CI, validates FR-1..FR-9); SM-2 external signal; SM-C1 counter-metric (no feature breadth).

### PRD Completeness Assessment (see below)

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement (abbrev.) | Epic Coverage | Status |
| --- | --- | --- | --- |
| FR-1 | Declare inference test `crucible.it(name, {runs?, threshold?}, body)`; integer-safe pass rule; smoke mode | Epic 1 (Stories 1.1, 1.4 — declaration + smoke) + Epic 2 (Story 2.1 — runs/threshold aggregation) | ✓ Covered |
| FR-2 | Parallel run execution by default | Epic 2 (Story 2.1) | ✓ Covered |
| FR-3 | Load state via `crucible.load()`; per-run isolation under parallel execution | Epic 2 (Story 2.2) | ✓ Covered |
| FR-4 | Append state after acts; subsequent assertions see accumulated state | Epic 2 (Story 2.2) | ✓ Covered |
| FR-5 | `crucible.coherent(response, claim)` boolean verdict; stateless mode; knowledge-boundary claims | Epic 1 (Stories 1.3, 1.4) | ✓ Covered |
| FR-6 | Instruction-schema-driven judging; schema edit changes behaviour without TS change | Epic 1 (Stories 1.3, 1.4) + Epic 3 (Story 3.4 conformance spike) | ✓ Covered |
| FR-7 | Provider config in `crucible.config.json`; fail-fast; infra failures = errored not semantic | Epic 1 (Stories 1.1, 1.2, 1.5) + Epic 2 (Story 2.3 sibling abort) | ✓ Covered |
| FR-8 | Actionable failure output: pass rate vs threshold, claim, excerpt, reasoning; errored visually distinct | Epic 3 (Story 3.1); provisional print in Epic 1 (Story 1.5) | ✓ Covered |
| FR-9 | Verbosity ladder (default/full/debug), config + env override | Epic 3 (Story 3.2) | ✓ Covered |

### NFR Coverage (report-lettered → epics)

| PRD NFR | Epics Equivalent | Status |
| --- | --- | --- |
| NFR-A cost/metering | epics NFR2 | ✓ |
| NFR-B secrets via env | epics NFR1 (`OPENROUTER_API_KEY`, `CRUCIBLE_` prefix reserved) — Stories 1.1, 1.2 | ✓ |
| NFR-C parallel wall-clock | epics FR2 — Story 2.1 | ✓ |
| NFR-D binomial headroom docs | epics NFR4 — Story 2.4, absorbed by 3.6 | ✓ |
| NFR-E portability (shell/schema split) | epics AR1/AR9 — Stories 1.3, 3.4 | ✓ |
| NFR-F CI lanes | epics AR10 — Stories 3.3, 3.5, 3.7 | ✓ |

### Missing Requirements

None. All 9 PRD FRs and all 6 PRD NFR-equivalents trace to at least one story.

### Items in Epics NOT in PRD (scope additions)

1. **Story 2.5 — `testDefaults` in config (project-wide runs/threshold defaults).** Not a PRD FR; epics cite "AD-9 as amended". Small, coherent addition; flag for awareness, not a defect — but PRD is not the source of record for it.
2. **Story 3.4 — language-agnostic judge conformance spike (docker + curl).** Extends FR-6/NFR-E beyond PRD's MVP wording (PRD ships the split as an architectural property; this makes it a repeatable check). Explicitly a spike allowed to spawn follow-ups.
3. **Threshold default 1.0 and validation to (0,1]** (epics FR1) — a refinement the PRD leaves unstated; consistent with PRD's integer-safe rule.

### Coverage Statistics

- Total PRD FRs: 9
- FRs covered in epics: 9
- Coverage: 100%
- PRD Open Questions resolved by epics/architecture: OQ-1 (`OPENROUTER_API_KEY` + `CRUCIBLE_` prefix, CI-secret docs in Story 3.6), OQ-3 (AR7 retry taxonomy + Story 2.3), OQ-7 (AsyncLocalStorage, AR5). OQ-6 partially (Story 1.3 records model behaviour notes). OQ-4 (Vitest) and OQ-5 (schema versioning → AR9: versioned by package version) addressed/deferred deliberately.

### PRD Completeness Assessment

Strong: FRs globally numbered with testable consequences; assumptions tagged and indexed; non-goals explicit; open questions tracked with owners (architecture vs docs). Gaps to watch downstream: NFRs unnumbered (extraction required lettering); OQ-3 (retry/backoff) and OQ-7 (state isolation) are architecture-owned and must be resolved in the architecture spine; no UX doc exists (acceptable — library product, no UI; terminal output in FR-8/FR-9 is the de facto UX surface).

## UX Alignment Assessment

### UX Document Status

Not found.

### Is UX Implied?

No. PRD §5 non-goals: "No hosted service, dashboard, UI." Product is a TypeScript library; the developer-experience surface is (a) the API (`crucible.it`/`load`/`coherent`), (b) terminal failure output (FR-8) and verbosity ladder (FR-9), (c) docs (AR13). Epics explicitly record "UX Design Requirements: N/A — library product, no UI. Terminal output contract is covered by FR8/FR9."

### Alignment Issues

None. The terminal-output DX contract is traced: PRD FR-8/FR-9 → architecture AD-13/report module (AR5, AR12 no-console-outside-report) → Stories 1.5, 3.1, 3.2. PRD's supporting `review-dx.md` exists as DX review input.

### Warnings

None. Missing UX doc is appropriate for this product type.

## Epic Quality Review

Standard applied: create-epics-and-stories best practices (user value, epic independence, no forward dependencies, story sizing, AC quality).

### Epic Structure

| Check | Epic 1 | Epic 2 | Epic 3 |
| --- | --- | --- | --- |
| User-value title/goal | ✓ "developer can … get a real semantic verdict" | ✓ "arrange per-run state and gate CI on pass rate" | ✓ "debug from terminal alone … publicly consumable" |
| Independently valuable | ✓ walking skeleton is shippable smoke-mode verdict | ✓ needs only Epic 1 | ✓ needs only Epics 1–2 |
| No forward epic dependency | ✓ | ✓ | ✓ |

No technical-milestone epics. Epic 1 correctly front-loads the riskiest bet (schema-driven judging) rather than infrastructure for its own sake.

### Story Dependency Analysis

All dependencies point backward:
- Epic 1: 1.1 (scaffold+config) → 1.2 (adapter) → 1.3 (schema spike, actually independent — could run first) → 1.4 (composes 1.1–1.3) → 1.5 (renders 1.4 failures).
- Epic 2: 2.1–2.3 build on Epic 1; 2.4 docs from 2.1 semantics; 2.5 extends 1.1 config.
- Epic 3: 3.1/3.2 extend 1.5; 3.3 → 3.5 (Makefile before CI lane) ordered correctly; 3.6 absorbs 2.4 (backward); 3.7 last.

No forward dependencies found. Database timing N/A (no persistence).

### Greenfield Checks

- Architecture specifies **no starter template** (hand-rolled per Structural Seed) — Story 1.1 correctly includes scaffold (tsdown dual build, TS strict, Node >=22, layout, CI lint+typecheck+unit). ✓
- CI pipeline established in first story; publish pipeline last (3.7). ✓

### AC Quality

Given/When/Then throughout; error paths covered (fail-fast config, 401 abort, retries-exhausted, invalid verbosity, unparseable judge reply); outcomes specific and measurable (⌈threshold×runs−1e-9⌉ bump case "0.35×20 needs 7 not 8", ~500-char excerpt cap, 3-attempt retry). Story→FR/AD traceability cited inline and verified against the architecture spine — every cited AD-1..AD-13 / AR exists and matches.

### Findings by Severity

#### 🔴 Critical Violations

None.

#### 🟠 Major Issues

None.

#### 🟡 Minor Concerns

1. **Story 1.1 ↔ 1.2 seam ambiguity.** Story 1.1's AC requires config load to resolve "the adapter singleton via `providers/registry`", but the OpenRouter adapter is built in Story 1.2. Implementing 1.1 needs at least a registry entry + adapter stub. Recommendation: note in 1.1 that the registry ships with a stub/skeleton openrouter entry, fleshed out in 1.2 — or accept the implied ordering.
2. **Story 1.1 is double-sized.** Bundles greenfield scaffold (build/CI/layout) and the config subsystem. Acceptable for a solo greenfield project; could split "1.0 scaffold" if velocity tracking matters.
3. **Story 2.4 AC constrains future work** ("Epic 3's docs stories link/absorb this content"). Not a blocking forward dependency — 3.6 carries the mirror AC — but 2.4's own completion should not be judged on Epic 3 behaviour. Cosmetic rewording only.
4. **Story 2.5 (`testDefaults`) has no PRD backing** — sourced from architecture AD-9 "as amended". Traceability gap PRD→epics only; architecture is consistent. Optionally amend PRD or accept spine as source of record.
5. **Numbering style drift**: PRD uses `FR-1`, epics use `FR1`. Cosmetic; keep one style when generating story files.
6. **Story 3.4 is deliverables-over-ACs** — declared spike, explicitly allowed to spawn follow-ups. Fine, but sprint planning should not gate release on its open-ended findings.

## Summary and Recommendations

### Overall Readiness Status

**READY** — proceed to Phase 4 implementation (sprint planning → story creation).

### Critical Issues Requiring Immediate Action

None. Zero critical or major findings. FR coverage 9/9 (100%); NFR coverage 6/6; architecture spine binds all FRs and every story's AD citation verified; epic sequencing has no forward dependencies; greenfield setup correctly placed.

### Minor Items (address opportunistically, none blocking)

1. Story 1.1 ↔ 1.2 seam: note that the provider registry ships a stub openrouter entry in 1.1, completed in 1.2.
2. Story 2.4's forward-looking AC ("Epic 3 docs absorb this") — reword as note; 3.6 already carries the mirror AC.
3. Story 2.5 `testDefaults`: PRD silent; architecture AD-9 is source of record — optionally amend PRD for traceability hygiene.
4. Numbering style (`FR-1` vs `FR1`) — pick one when generating story files.
5. Treat Story 3.4 (conformance spike) as non-gating for release.

### Recommended Next Steps

1. Run sprint planning (`bmad-sprint-planning`) to generate sprint status from epics.md.
2. Create the first story (`bmad-create-story`) — Story 1.1, folding in minor item 1's stub-registry note.
3. Optionally patch epics.md for minor items 2/4 before story generation (5-minute edit).

### Final Note

This assessment identified 6 minor issues across 2 categories (traceability hygiene, story wording) and 0 critical/major issues. The planning set (PRD + addendum, architecture spine, epics) is unusually well-aligned: requirements are testable, every FR traces to stories, the architecture resolves all PRD open questions it owns (OQ-1, OQ-3, OQ-7), and the epic sequence front-loads the core technical bet. Proceed as-is or apply the minor edits first.

---
*Assessed 2026-08-16 by implementation-readiness workflow (BMad) for Jack.*
