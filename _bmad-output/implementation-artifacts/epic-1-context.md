# Epic 1 Context: First semantic assertion (walking skeleton)

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A developer can install crucible-ai, configure OpenRouter, and get a real semantic verdict inside a Jest test: `crucible.it()` in smoke mode (single run), `crucible.coherent(response, claim)` judged by an LLM following a markdown instruction schema, fail-fast config validation, a retry taxonomy that separates infrastructure failures from semantic verdicts, and a minimal failure print that includes the judge's reasoning. This epic proves the project's core bet — schema-driven judging with zero evaluation logic in TypeScript — earliest and cheapest, before multi-run reliability measurement (Epic 2) and full diagnostics/shipping (Epic 3) build on it.

## Stories

- Story 1.1: Install and configure Crucible
- Story 1.2: Reliable judge connectivity via OpenRouter
- Story 1.3: Design the `coherent` instruction schema (spike)
- Story 1.4: First semantic verdict (smoke mode)
- Story 1.5: See why it failed

## Requirements & Constraints

- **Test declaration (smoke mode only in this epic):** `crucible.it(name, { runs?, threshold? }, body)` registers exactly one Jest test alongside ordinary tests. Omitted `runs` → 1; omitted `threshold` → 1.0; threshold validated to (0, 1]. Multi-run aggregation is Epic 2 — this epic delivers the single-run path.
- **Coherence assertion:** `crucible.coherent(response, claim)` resolves to `Promise<boolean>` — semantic coherence of the response with the claim given loaded state; with no state loaded, the claim is judged against the response alone (stateless mode). Knowledge-boundary (anti-omniscience) claims are first-class: state establishing what should *not* be revealed must yield `false` when the response leaks it. Canonical fixture: state places Jane and Bob apart; a response placing them together must fail the claim "Jane won't find Bob, because they aren't in the same place".
- **Schema-driven judging:** each assertion's evaluation procedure lives entirely in a language-agnostic markdown instruction schema; editing `schemas/coherent.md` changes judge behaviour with zero TypeScript change.
- **Provider configuration:** provider, model, and provider-specific `meta` passthrough (sent to the provider unmodified) live in committable `crucible.config.json` at project root. Unsupported provider, missing model, or malformed file fails fast at config load with an actionable error — never mid-run.
- **Secrets:** API keys come only from the adapter's declared provider-native env var (`OPENROUTER_API_KEY`); no key field is accepted in the config file. The `CRUCIBLE_` env prefix is reserved for crucible-owned settings.
- **Infra vs semantics:** judge infrastructure failures (429/timeout/5xx, unparseable replies) are never semantic failures — the run is *errored*, rendered distinct from *failed*, with the cause named.
- **Cost discipline:** one judge call per assertion per run; no judge traffic outside explicit test execution; registration must never trigger config load or provider traffic.
- **Judge reliability stance:** false-negatives are an accepted limitation, mitigated by narrow single-claim assertions.

## Technical Decisions

- **Layout & dependency direction:** hand-rolled greenfield package — `src/bindings/jest.ts` (inert one-liner registrar), `src/core/` (runner, aggregate, state, judge, report, config), `src/providers/` (types = port, openrouter.ts, registry.ts), `schemas/`, `e2e/`, `docs/`. Core never imports adapters or bindings; adapters and bindings never import each other; only `core/config` calls `providers/registry`.
- **Stack:** TypeScript 6.x strict; Node engines >=22 (CI matrix 22/24); Jest 30 as peer dependency, never a dependency — framework globals reached lazily at call time; tsdown dual ESM+CJS build; one `crucible` namespace re-exported by the main entry. CI (GitHub Actions) PR lane: lint + typecheck + unit, zero provider traffic.
- **Registration inert / execution lazy:** `crucible.it()` stores options only; the body runs via `runner.execute` inside the registered test. `config.get()` is memoized, first invoked at execution of the first run; config load resolves the adapter singleton via the registry and computes `effectiveVerbosity` (env overrides config).
- **Run scope:** `core/state` owns a single `AsyncLocalStorage` holding `RunContext { state, verdicts, errors }`; the runner enters scope only via `state.enterRun(body)`; all access through `state` accessors (direct import, never a parameter). Accessor calls outside a run scope fail fast as `usage` errors. Even the single smoke run executes inside this scope.
- **Judge = one stateless completion:** system prompt = the assertion's schema file; user content = state + response + claim (assembly order documented in the schema itself, so any language shell can reproduce it). Reply must parse as strict JSON `{ "verdict": boolean, "reasoning": string }`; parsing, validation, and the unparseable→retryable classification live only in `core/judge`. Before resolving its boolean, the judge appends a `VerdictRecord { assertion, claim, verdict, reasoning, seq }` (or `ErrorRecord { cause, attempts }` on exhausted retries) to the ambient RunContext.
- **Provider port:** `complete(request, signal: AbortSignal): Promise<string>` — raw completion text, no verdict semantics in adapters. The adapter only sends the request, classifies failures retryable (429/timeout/5xx) vs fatal (400/401/unknown model), and declares its API-key env var; missing key is a fatal `config` error. Core owns retry: max 3 attempts, exponential backoff with jitter, then the run is errored (`CrucibleError` kind `infra`, `retryable: true`). Fatal errors surface immediately without retry.
- **Assertion surface:** native boolean only — `expect(await crucible.coherent(...)).toBe(true)`; no custom matchers. The framework asserts; the reporter explains.
- **Reporting:** all user-facing output — including the thrown `CrucibleVerdictError` message — is rendered exclusively by `core/report` from run records at verdict time. No `console.*` anywhere else. Epic 1 ships a provisional print: claim, bounded response excerpt (~500 chars default), judge reasoning; errored rendered as errored-not-failed with the infra cause. The full FR8/FR9 contract lands in Epic 3.
- **Errors:** one `CrucibleError` base with `kind: 'config' | 'usage' | 'infra'`; verdicts surface as `CrucibleVerdictError`.
- **Schemas:** ship in the package under `schemas/`, named per assertion (`coherent.md`), frontmatter carrying `name` + output contract, versioned by package version, no TypeScript- or provider-specific instructions.
- **Conventions:** kebab-case files; env access only in `core/config` + adapter key lookup; terminology is "state" — never domain vocabulary like "world state" or "chat history" in API, docs, or artifacts.
- **Project-wide development rules (binding for all implementation):**
  - TDD mandatory: red-green-refactor; a failing test precedes every piece of `src/` behaviour. Scaffold/config files (package.json, tsconfig, CI yaml) are exempt.
  - Mock boundaries only (network, filesystem, clock, provider APIs); prefer real collaborators everywhere else.
  - When a consumer/dependency does not yet exist, bind to its spec (port interface + contract tests) — never ship stub implementations in `src/`. Spike harnesses (Story 1.3) are explicitly non-library scratch code and exempt.

## Cross-Story Dependencies

- Story 1.1 establishes the package scaffold, config loading, and registry that every later story builds on; it resolves the 1.1↔1.2 seam spec-first — port interface + contract tests with test-double fakes, no shipped stub adapter (Story 1.2 builds the real adapter as a complete unit).
- Story 1.3 is a pure spike (throwaway harness, raw HTTP against OpenRouter, no library code): its validated `schemas/coherent.md` is the artifact Story 1.4 wires the judge to, and its model-behaviour notes feed the deferred judge-model guidance. It can run in parallel with 1.1/1.2.
- Story 1.4 depends on 1.1 (config), 1.2 (adapter + retry), and 1.3 (schema); Story 1.5 depends on 1.4's records to render.
- Epic 2 extends this epic's runner/aggregate/state seams (multi-run, load/append, sibling abort); Epic 3 extends the reporter (full output contract, verbosity ladder). Build to the seams, don't pre-build the features.
