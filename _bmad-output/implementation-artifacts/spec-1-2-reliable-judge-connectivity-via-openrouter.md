---
title: 'Story 1.2 — Reliable judge connectivity via OpenRouter'
type: 'feature'
created: '2026-09-14'
status: 'in-review'
baseline_revision: '08ed008889f8bd8dbf77607c90f147aa72a7948c'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Crucible has a provider port spec but no real provider — no judge call can reach a model, and there is no retry machinery separating transient provider flake from fatal misconfiguration.

**Approach:** Implement `OpenRouterAdapter` against the existing port (`src/providers/types.ts`) exactly as the FakeAdapter contract does, register it as the built-in `openrouter` provider, and add a core retry executor (max 3 attempts, exponential backoff + jitter) that consults the adapter's failure classification. Network and clock are injected boundaries.

## Boundaries & Constraints

**Always:** All CLAUDE.md development + testing rules (TDD; colocated functional tests; no comments; end-grouped named exports; OOP internals; boundaries injected — network via a fetch-like function, clock via an injected sleep, env key lookup via an injected reader defaulting to `process.env.OPENROUTER_API_KEY`). Adapter returns the completion TEXT untouched — transport-envelope unwrapping only, zero verdict semantics (AD-8). Core owns retry; adapter only classifies. `meta` spreads into the provider request unmodified (FR7). Adapter construction and registration stay side-effect-free — key is read at first `complete()`, never at import/registration (AD-9). Env access only in the adapter's key lookup + `core/config` (AR12).

**Block If:** The port spec (`ProviderAdapter`) proves insufficient for a real adapter in a way that forces a breaking change to `types.ts` — that seam is Story 1.1's published contract; stop and report rather than reshape it unilaterally.

**Never:** No judge module, no schema handling, no runner (Stories 1.3–1.4). No real network or real timers in unit tests. No changes to `ProviderRegistry` behavior. No `console.*`. No files in `src/api/` — the adapter and retrier are internals. No e2e (Story 3.3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Successful completion | 200, body with completion text `x` | `complete()` resolves exactly `x`, untouched | No error expected |
| Meta passthrough | `meta: { provider: "atlascloud", reasoning: "minimal" }` | Provider request body carries those fields unmodified (captured via fake fetch) | No error expected |
| Missing API key | key reader returns undefined/empty | — | `CrucibleError` kind `config` at first `complete()`, no network call made |
| Retryable statuses | 429, 500, 502, 503, timeout/network failure, malformed envelope JSON | thrown error classified `retryable` by `classifyFailure` | — |
| Fatal statuses | 400, 401, 403, 404 (unknown model) | classified `fatal` | — |
| Retry then success | attempt 1 retryable, attempt 2 succeeds | retrier resolves attempt 2's text; injected sleep awaited between attempts | No error surfaces |
| Retries exhausted | 3 retryable failures | — | `CrucibleError` kind `infra`, `retryable: true`, cause = last provider error |
| Fatal short-circuit | first attempt fatal | exactly one adapter call | `CrucibleError` kind `infra`, `retryable: false`, cause preserved; no sleep |
| Abort | signal aborted before/during | rejection propagates as-is | never retried, never reclassified |

</intent-contract>

## Code Map

Existing (Story 1.1 — bind, do not reshape):
- `src/providers/types.ts` -- port: `CompletionRequest {model, prompt, meta?}`, `complete(request, signal)`, `classifyFailure`, `envVar`
- `src/providers/registry.ts` -- `ProviderRegistry` class + `providerRegistry` singleton
- `src/providers/fake-adapter.ts` -- contract double; the real adapter must satisfy the same port
- `src/core/errors.ts` -- `CrucibleError` (`kind`, `retryable`, `cause`)

New:
- `src/providers/openrouter.ts` -- `OpenRouterAdapter` class; ctor injects fetch-like fn (default `globalThis.fetch`) + key reader (default env lookup); `complete()` POSTs chat-completions request (`https://openrouter.ai/api/v1/chat/completions`, bearer key, `{model, messages:[{role:'user',content:prompt}], ...meta}`), unwraps completion text; throws classifiable errors carrying status; `classifyFailure` per matrix; `envVar = 'OPENROUTER_API_KEY'`
- `src/providers/openrouter.test.ts` -- colocated; fake fetch boundary; matrix rows 1–5
- `src/providers/registry.ts` (edit) -- `providerRegistry` singleton registers built-in `openrouter` adapter (construction side-effect-free)
- `src/providers/registry.test.ts` (edit) -- default singleton resolves `openrouter`
- `src/core/retry.ts` -- `RetryingCompleter` class: ctor injects sleep `(ms) => Promise<void>` (+ optional backoff base/jitter source for determinism); `complete(adapter, request, signal)` implements attempts/backoff/classification per matrix
- `src/core/retry.test.ts` -- colocated; scripted failing adapters (extend/wrap FakeAdapter pattern) + fake sleep recording waits

## Tasks & Acceptance

**Execution:**
- [x] `src/providers/openrouter.ts` + `openrouter.test.ts` -- TDD: success, meta passthrough, missing-key config error before network, classification table, envelope-unwrap only -- the story's core deliverable
- [x] `src/providers/registry.ts` + `registry.test.ts` -- TDD: built-in `openrouter` registration on the singleton -- config `provider: "openrouter"` resolves without user wiring
- [x] `src/core/retry.ts` + `retry.test.ts` -- TDD: retry/backoff/fatal/abort semantics per matrix with injected sleep -- shared machinery Story 1.4's judge calls through

**Acceptance Criteria:**
- Given a config naming `openrouter` and the 1.1 `ConfigStore`, when `config.get()` runs with a fake boundary, then the resolved `provider` is the `OpenRouterAdapter` singleton (existing config tests keep passing).
- Given the full suite, when `npm run lint && npm run typecheck && npm test && npm run build` run, then all pass with zero network and zero real timers.
- Given the FakeAdapter contract tests, when the same behavioral expectations are applied to `OpenRouterAdapter` with a fake fetch, then it satisfies the port identically (abort rejection included).

## Design Notes

- Retrier consults `adapter.classifyFailure(error)` — it never inspects errors itself; classification stays the adapter's single responsibility.
- Backoff shape (base/jitter) is an injected policy detail, not asserted precisely in tests — tests assert only that sleep is awaited between retryable attempts and never after fatal/abort.
- Adapter throws a typed internal error carrying HTTP status so `classifyFailure` branches on data, not message text.

## Spec Change Log

## Review Triage Log

### 2026-09-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12: (high 1, medium 5, low 6)
- defer: 1: (high 0, medium 1, low 0)
- reject: 6: (high 0, medium 0, low 6)
- addressed_findings:
  - `[high]` `[patch]` retrier rewrapped fatal `CrucibleError` as `infra`, erasing the `config` kind for a missing API key — crucible errors now rethrown unchanged (retryable-infra retried, everything else propagates); test pins kind survival
  - `[medium]` `[patch]` 402/405/410/422 retried pointlessly — fatal is now all 4xx except 408/429; classification table tests extended
  - `[medium]` `[patch]` HTTP-200-with-`{error}` envelope retried blindly — embedded error with numeric code classified by that code, otherwise retryable; 3 tests
  - `[medium]` `[patch]` abort ignored during backoff — retrier checks the signal before every attempt and surfaces the abort reason; abort-during-sleep test added
  - `[medium]` `[patch]` `meta` could clobber `model`/`messages` — protected fields now win the spread; collision test
  - `[medium]` `[patch]` registry test asserted `toBeInstanceOf(OpenRouterAdapter)` (wiring test violating project testing rules) — replaced with behavioral singleton + envVar assertions
  - `[low]` `[patch]` `classifyFailure` ignored a crucible infra error's own `retryable` flag — now respected; tests
  - `[low]` `[patch]` key validated trimmed but sent untrimmed — trimmed key sent; test
  - `[low]` `[patch]` unserializable `meta` classified retryable — now `usage` error before any network call; test
  - `[low]` `[patch]` backoff off-by-one naming + unclamped negative delay/base — renamed `delayForRetry`, clamped ≥ 0 (base ≥ 1); hostile-jitter test
  - `[low]` `[patch]` ScriptedAdapter read past its script (TypeError in future tests) — guarded with a clear rejection
  - `[low]` `[patch]` already-aborted path now proven to make zero adapter calls (assertion strengthened)

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0
- `npm test` -- expected: all green, zero network/timers
- `npm run build` -- expected: dist emits cleanly

## Auto Run Result

**Summary:** Story 1.2 implemented — `OpenRouterAdapter` (injected fetch + key reader, bearer-authorized chat-completions call, envelope unwrap only, data-driven failure classification) registered as the built-in `openrouter` provider, plus `RetryingCompleter` in core (injected sleep, 3 attempts, exponential backoff + jitter, fatal short-circuit, abort-aware, crucible-error taxonomy preserved). TDD throughout; 85 tests, zero network/timers, suite 0.44s.

**Files:** new `src/providers/openrouter.ts` + `openrouter.test.ts`, `src/core/retry.ts` + `retry.test.ts`; edited `src/providers/registry.ts` (built-in registration) + `registry.test.ts`, `src/core/config.test.ts` (acceptance: config → openrouter singleton).

**Review findings breakdown:** 12 patched (1 high — retrier erased the `config` error kind; 5 medium; 6 low — all fixed test-first), 1 deferred (per-attempt timeout policy → Story 1.4 runner/budget work), 6 rejected (fetch-less runtimes below engines floor, empty-completion policing in the adapter, dual-build double-registration, error-body message enrichment, duplicate-coverage claim on the spec-mandated acceptance test, reserved-name registration UX).

**Follow-up review recommendation:** true — the review pass changed classification and retry semantics broadly (taxonomy propagation, status table, embedded-error handling, abort paths); an independent pass over the final state is warranted.

**Verification:** `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (85/85, 0.44s, zero network/real timers), `npm run build` ✓. Conventions: no comments in new src, no `console.*`, `process.env` only in the adapter's default key reader + `core/config`, end-grouped named exports.

**Residual risks:** OpenRouter envelope/status behavior asserted against a faked boundary — real-wire confirmation lands with Story 3.3 e2e; no per-attempt timeout until 1.4 (deferred); `RetryingCompleter` has no consumer yet — Story 1.4's judge is its first caller.
