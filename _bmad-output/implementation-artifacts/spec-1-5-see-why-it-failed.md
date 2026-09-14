---
title: 'Story 1.5 — See why it failed'
type: 'feature'
created: '2026-09-14'
status: 'done'
baseline_revision: '0e9c15f2acaab5a11b599b84a1264b1fd4613665'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** A failing smoke test today surfaces Jest's bare "expected true, received false" — the judge's reasoning, the claim, and the response are all recorded in the run context and then thrown away. Errored runs are indistinguishable from semantic failures.

**Approach:** Add `core/report` (the sole rendering authority) and `CrucibleVerdictError`; the runner catches a run's rejection, classifies it failed-vs-errored, and throws a `CrucibleVerdictError` whose message is rendered exclusively from the run records — claim, bounded response excerpt, judge reasoning for failures; the named infrastructure cause, visually distinct as *errored, not failed*, for infra errors.

## Boundaries & Constraints

**Always:** All CLAUDE.md rules (TDD, colocated functional tests, one class per file, fakes one-per-file, class-hosted helpers, no comments, end exports, Prettier-clean). All user-facing text is rendered by `core/report` from run records at verdict time — no `console.*` anywhere (AD-10, AR12); the thrown error message IS the output. First error per failing run = lowest-`seq` false verdict or error record (AD-13). Response excerpt bounded at 500 characters (PRD default; configurability is Epic 3). `VerdictRecord` gains the `response` field the reporter needs — judge records it at judgment time; reporter does all truncation/formatting. Run-outcome classification mirrors AD-4: rejection carrying `CrucibleError` kind `infra` → errored; any other rejection → failed. The reporter is a pure formatter — its rendered string is its behavioral contract (test its content/boundedness like `PayloadAssembler`, not like thrown-error messages).

**Block If:** none anticipated — all seams exist.

**Never:** No verbosity ladder or `full`/`debug` rendering (Story 3.2). No multi-run pass-rate output, no discarded-run rendering (Stories 2.x/3.1 — this story renders a single smoke run). No `console.*`, no file output. No changes to judge parsing/retry semantics.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Semantic failure | body rejects (assertion), context holds a false `VerdictRecord` | runner throws `CrucibleVerdictError` `outcome: 'failed'`; message includes the claim, the response excerpt, the judge's reasoning; original rejection preserved as `cause` | — |
| Errored run | body rejects with `CrucibleError` kind `infra` (context holds an `ErrorRecord`) | `CrucibleVerdictError` `outcome: 'errored'`; message states errored-not-failed and names the infrastructure cause | — |
| Non-verdict failure | body rejects with a plain error, no false verdict recorded | `CrucibleVerdictError` `outcome: 'failed'`; message carries the original failure; cause preserved | — |
| Long response | recorded response > 500 chars | excerpt truncated to 500 chars with a truncation marker | — |
| Multiple records | two false verdicts in one run | the lowest-`seq` one is rendered (first error per run) | — |
| Passing run | body resolves | runner resolves; nothing rendered, nothing thrown | — |


## Code Map

Existing (bind as-is): `src/core/{state,judge,runner,errors}.ts`, `src/bindings/jest.ts`, `src/api/crucible.ts`, fakes under `*/test/`.

New / edited:
- `src/core/verdict-error.ts` -- NEW `CrucibleVerdictError extends Error` with `outcome: 'failed' | 'errored'` and `cause`; name set for clean Jest display
- `src/core/report.ts` -- NEW `Reporter` class (pure formatter): `renderFailed(context, cause)` and `renderErrored(context, cause)` (or one `render(outcome, …)`) producing the message from records — claim, 500-char bounded excerpt with marker, reasoning; errored: "errored, not failed" + cause name/message; falls back to the raw cause when no matching record exists
- `src/core/report.test.ts` -- NEW colocated: matrix rows (content presence, boundedness, lowest-seq selection, errored wording, fallback)
- `src/core/state.ts` (edit) -- `VerdictRecord` gains `response: string`
- `src/core/judge.ts` (edit) -- records the judged response on the verdict record
- `src/core/judge.test.ts` (edit) -- record equality updated for the new field
- `src/core/runner.ts` (edit) -- `execute` catches the body rejection inside the run scope (records still accessible), classifies infra→errored / other→failed, throws `CrucibleVerdictError` with the rendered message and original cause; resolves untouched on success
- `src/core/runner.test.ts` -- NEW colocated: classification + cause preservation + pass-through on success (message content itself is the Reporter's tested contract, not re-tested here — assert outcome field and instance only)
- `src/api/crucible.ts` + `src/index.ts` (edit) -- export `CrucibleVerdictError` (consumers may catch it)

## Tasks & Acceptance

**Execution (TDD each):**
- [x] `src/core/verdict-error.ts` + `src/core/report.ts` + `report.test.ts` -- the rendering authority
- [x] `src/core/state.ts` + `judge.ts` (+ test updates) -- response captured on the verdict record
- [x] `src/core/runner.ts` + `runner.test.ts` -- catch, classify, render, throw
- [x] `src/api/crucible.ts` + `src/index.ts` -- public `CrucibleVerdictError` export

**Acceptance Criteria:**
- Given a smoke test whose `coherent()` resolved false and whose `expect` threw, when the run rejects, then the surfaced error is a `CrucibleVerdictError` whose message shows the claim, a bounded response excerpt, and the judge's reasoning — rendered solely by `core/report` from run records.
- Given a run that errored (retries exhausted or fatal), then the surfaced error renders as errored-not-failed and names the infrastructure cause.
- Given the full suite, `npm run lint && npm run typecheck && npm test && npm run build` all pass; grep confirms no `console.*` anywhere in `src/`.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` -- all green, zero network/timers
- `grep -rn 'console\.' src --include='*.ts'` -- no hits

### 2026-09-14 — Review pass (appended to Review Triage Log)
- intent_gap: 0
- bad_spec: 0
- patch: 14: (high 1, medium 3, low 10)
- defer: 0
- reject: 1: (low 1)
- addressed_findings:
  - `[high]` `[patch]` config/usage CrucibleErrors were rebranded as semantic failed verdicts — runner now rethrows non-infra crucible errors untouched (misconfiguration stays fail-fast, consumer error type stable)
  - `[medium]` `[patch]` wrapped/re-thrown infra errors classified failed — runner walks the cause chain
  - `[medium]` `[patch]` AD-13 violated across mixed records — first failure now selected by lowest seq across false verdicts AND error records
  - `[medium]` `[patch]` real rejection hidden when a false verdict existed — failed render always appends the thrown cause
  - `[low]` `[patch]` double-wrap guard for CrucibleVerdictError; 500-bound tested with a literal (constant export removed); surrogate-pair-safe truncation; VerdictOutcome exported; attempts rendered on errored runs; errored render names the terminal rejection (retrier summary preserved) instead of preferring record cause; vacuous not.toBe assertion replaced; jest.test registration guard; non-Error causes rendered via JSON (never [object Object]) with unrenderable fallback; Reporter wired explicitly at the composition root
- rejected: report-label spoofing (cosmetic — the human-read report is not parsed; the judge payload, which is, was fenced in 1.4)

## Auto Run Result

**Summary:** Story 1.5 implemented — failing smoke tests now explain themselves. `Reporter` (sole rendering authority) builds the `CrucibleVerdictError` message from run records: claim, 500-char surrogate-safe response excerpt, judge reasoning, and the thrown cause for failures; errored-not-failed wording with terminal cause + judge attempt count for infra errors. Runner classifies by walking the cause chain (infra → errored), rethrows config/usage and already-wrapped verdict errors untouched. `VerdictRecord` carries the judged response. `CrucibleVerdictError` + `VerdictOutcome` exported publicly. Epic 1 walking skeleton complete.

**Review:** 14 patched test-first (1 high, 3 medium, 10 low), 0 deferred, 1 rejected. followup_review_recommended: true — classification semantics changed in the patch pass.

**Verification:** lint ✓ format ✓ typecheck ✓ 137/137 (zero network/timers) ✓ build ✓; no console.* in src.
