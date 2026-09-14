---
title: 'Story 1.4 — First semantic verdict (smoke mode)'
type: 'feature'
created: '2026-09-14'
status: 'done'
baseline_revision: 'da955969628672f0280103b72563927e68678127'
final_revision: 'e5d25068f0403051dbe938b9a662b0afa2ee3474'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** All the plumbing exists (config, registry, adapter, retrier, validated schema) but nothing connects it — `crucible.it()` and `crucible.coherent()` still throw "not implemented". No semantic verdict can happen inside a Jest test.

**Approach:** Build the vertical slice for a single run: ambient run scope (`core/state`), schema-driven judge (`core/judge`), smoke-mode runner (`core/runner`), inert Jest registrar (`bindings/jest`), and wire the real `crucible.it`/`crucible.coherent` in `src/api`.

## Boundaries & Constraints

**Always:** All CLAUDE.md rules (TDD; colocated functional tests; fakes one-per-file `.fake.ts`; class-hosted helpers; no comments; end-grouped named exports; OOP internals with injected collaborators; outcome assertions only). Evaluation semantics stay in `schemas/coherent.md` — TypeScript assembles, transports, parses; never judges (AD-1). One judge completion per assertion: system prompt = schema file, user payload per the schema's documented assembly order (AD-7). Parsing and unparseable→retryable classification live only in `core/judge`. `core/state` owns the SINGLE AsyncLocalStorage; access via accessors only; accessors outside a run scope throw `usage` (AD-5). Registration is inert: `crucible.it()` stores and registers only — config loads at first run execution (AD-9). Jest globals reached lazily at call time; registrar injected for tests. Judge appends `VerdictRecord { assertion, claim, verdict, reasoning, seq }` (or `ErrorRecord { cause, attempts }` on exhausted retries) to the ambient context before resolving (AD-13). Boolean surface only — no custom matchers (AD-6).

**Block If:** AsyncLocalStorage proves incompatible with Jest 30 ESM VM modules (context lost across await) — stop and report rather than switching to an explicit-handle API, which would break the PRD's ambient contract.

**Never:** No runs/threshold aggregation, no parallelism, no three-zone verdict (Story 2.1). No `crucible.load`/`append` implementation (Story 2.2) — RunContext carries the `state: string[]` field now, but the public members keep throwing `usage` "coming in Story 2.2". No report module or `CrucibleVerdictError` rendering (Story 1.5) — a failed run's rejection propagates as-is. No payload-capture unit tests — payload assembly correctness is proven by e2e against the real provider (Story 3.3), not by inspecting fake-adapter arguments. No real network/timers in unit tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Verdict true | inside run; adapter reply `{"verdict":true,"reasoning":"…"}` | `coherent()` resolves `true` | No error expected |
| Verdict false | adapter reply verdict false | resolves `false` | No error expected |
| Padded reply | reply wrapped in whitespace/newlines | parsed, resolves boolean | No error expected |
| Unparseable reply | non-JSON, or JSON missing boolean `verdict` / string `reasoning` | — | `CrucibleError` kind `infra`, `retryable: true` — never a verdict |
| Outside run scope | `coherent()` with no ambient run | — | `CrucibleError` kind `usage`, thrown fast |
| Infra failure | retrier exhausts/fatal beneath the judge | — | infra error propagates; `ErrorRecord` appended to context |
| Smoke run | `crucible.it(name, body)` (opts omitted) | exactly one test registered; body executes exactly once, inside a run scope, only when the registered test runs | Body rejection propagates as-is |
| Inert registration | `crucible.it()` called at module load | no body execution, no config/env read | — |
| Scope isolation | two concurrent `enterRun` scopes | each sees only its own context (verdicts/state never bleed) | — |
| Verdict recorded | successful judgment | `VerdictRecord` with claim/verdict/reasoning/seq readable via state accessor within the run | — |

</intent-contract>

## Code Map

Existing (bind as-is): `src/core/{errors,config,retry}.ts`, `src/providers/{types,registry,openrouter}.ts`, `schemas/coherent.md`, fakes under `*/test/`.

New:
- `src/core/state.ts` -- `RunContext` type (`state: string[]`, `verdicts: VerdictRecord[]`, `errors: ErrorRecord[]`, seq counter); `RunScope` class owning the single `AsyncLocalStorage`; `enterRun(body)`, accessor(s) that throw `usage` outside a scope; record-append methods. Export a `runScope` singleton.
- `src/core/state.test.ts` -- isolation, outside-scope usage error, record visibility.
- `src/core/schema-source.ts` -- `SchemaSource` boundary class: reads `schemas/<name>.md` from the package root (fs boundary, injected in tests); strips frontmatter is NOT needed — full file is the system prompt.
- `src/core/judge.ts` -- `Judge` class (injected: schema text provider, `RetryingCompleter`, adapter+model+meta supplier). `judgeCoherent(response, claim)`: reads ambient context (usage error if none), assembles payload per schema order (STATE only when non-empty), one completion via retrier, trims + parses strict JSON in this module only, validates shape, appends `VerdictRecord`/`ErrorRecord`, resolves boolean. Wrong shape/unparseable → infra retryable.
- `src/core/judge.test.ts` -- via scripted fake adapter: matrix rows 1–6, 10.
- `src/core/runner.ts` -- `Runner` class: `execute(body)` = one `enterRun(body)`; smoke only.
- `src/bindings/jest.ts` -- `JestBinding` class with injected registrar (default: lazy `globalThis.it`); `register(name, optsOrBody, body?)` normalizes the optional opts param, registers ONE test with a per-test timeout constant (30s smoke budget, AD-3), whose callback is `runner.execute(body)`.
- `src/bindings/jest.test.ts` -- fake registrar: rows 7–8 (one registration; inert; body-once when invoked).
- `src/core/test/registrar.fake.ts`, plus any new fakes one-per-file.
- `src/api/crucible.ts` (edit) -- `it` and `coherent` become real (composition root: lazy singletons wiring config→judge/runner/binding at first execution, never at import); `load` keeps `usage` throw ("coming in Story 2.2").
- `src/index.ts` -- unchanged surface.

## Tasks & Acceptance

**Execution (TDD each):**
- [x] `src/core/state.ts` + test -- run scope, isolation, records, usage error -- foundation for everything ambient
- [x] `src/core/schema-source.ts` -- fs boundary for schema text (covered through judge tests with a fake source; the real class is a thin boundary)
- [x] `src/core/judge.ts` + test -- the story's core: schema-as-system-prompt completion → strict parse → record → boolean (port gained optional `system` field so the schema travels as a true system message per AD-7 — additive, fakes unaffected)
- [x] `src/core/runner.ts` + `src/bindings/jest.ts` + tests -- smoke execution + inert single registration
- [x] `src/api/crucible.ts` -- wire real `it`/`coherent`; import stays side-effect-free

**Acceptance Criteria:**
- Given a `crucible.it('name', body)` declaration with a body calling `expect(await crucible.coherent(response, claim)).toBe(true)` against a scripted fake adapter, when the registered test executes, then the body runs exactly once inside a run scope and the assertion sees the scripted verdict.
- Given the suite, when `npm run lint && npm run typecheck && npm test && npm run build` run, then all green, zero network/timers.
- Given `schemas/coherent.md` is edited, when the judge runs, then behaviour follows the new schema with zero TS changes (architectural: schema text flows uninterpreted from `SchemaSource` to the system prompt — verified by the judge never branching on schema content).
- Given import of the package with no config present, then nothing throws (registration inertness preserved).

## Design Notes

- Composition root lives in `src/api/crucible.ts` behind lazy initialization — the only place real collaborators (config singleton, OpenRouter adapter via `config.get().provider`, fs SchemaSource, RetryingCompleter) are assembled.
- Judge parse: trim the reply, `JSON.parse`, require `typeof verdict === 'boolean' && typeof reasoning === 'string'`; anything else → infra retryable. Mirrors the schema's output contract exactly.
- The canonical Jane/Bob real-model behaviour was proven in Story 1.3 (60/60); unit tests script the adapter — real-wire verification is Story 3.3's e2e.

## Spec Change Log

## Review Triage Log

### 2026-09-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12: (high 2, medium 5, low 5)
- defer: 2: (medium 2)
- reject: 4: (low 4)
- addressed_findings:
  - `[high]` `[patch]` payload section-forgery: RESPONSE/CLAIM text could inject fake section headers — new `PayloadAssembler` fences every section (`<<<`/`>>>`, sentinel lines in content escaped); schema updated with fencing + data-not-instructions rules; assembler unit-tested as a pure formatter
  - `[high]` `[patch]` unparseable-reply failures left no `ErrorRecord` — judge now records on every failure path before rethrowing
  - `[medium]` `[patch]` "retryable" parse failure was never retried — judge re-asks once on an unparseable reply before surfacing the infra error
  - `[medium]` `[patch]` dead abort signal — judge calls now carry `AbortSignal.timeout(30s)` so a hung provider call can't dangle past the test
  - `[medium]` `[patch]` options silently swallowed — `RunOptions` typed to `{runs?, threshold?}`; `runs`/`threshold` present → loud usage error naming Story 2.1; unknown keys (typos) rejected at registration
  - `[medium]` `[patch]` SchemaSource untested/unguarded — colocated tests added (injected fake fs); schema memoized (read-once) and empty/whitespace schema is a config error
  - `[medium]` `[patch]` global-`it` detection — non-callable check added; honest message naming the Jest injected-globals requirement
  - `[low]` `[patch]` `coherent()` accepted non-strings — usage error before any spend, tests
  - `[low]` `[patch]` counting wrapper hand-clone — kept explicit delegation (spread drops class prototype methods — discovered red)
  - `[low]` `[patch]` fenced JSON replies rejected — markdown fences stripped before parse, test
  - `[low]` `[patch]` unasserted state-push removed from binding test
  - `[low]` `[patch]` public `RunOptions`/`TestBody` types re-exported through `src/api/` + entry

### Deferred
- CJS/bundler-inlined consumers may break the `import.meta.url` package-root walk — verify against the built artifact in Story 3.3 e2e.
- `injectGlobals: false` Jest setups unsupported (lazy `@jest/globals` import is the candidate fix) — documented in the binding's error message; revisit with Story 3.6 gotchas.

### Rejected
- 30s per-test timeout override (AD-3 mandates the runner set it; sizing from run count/budget is Story 2.1), write-only `state` (2.2 forward-wiring per spec), mutable context internals (unreachable from the public surface), vitest false-positive on global `it` (undetectable reliably).

## Verification

**Commands:**
- `npm run lint` -- exit 0
- `npm run typecheck` -- exit 0
- `npm test` -- all green, zero network, sub-second
- `npm run build` -- dist emits, schema NOT bundled (stays a runtime file read)

## Auto Run Result

**Summary:** Story 1.4 implemented — the vertical slice making `crucible.it()` (smoke mode) and `crucible.coherent()` real: `RunScope` (single AsyncLocalStorage, verdict/error records, fresh context per run), `PayloadAssembler` (fenced injection-resistant sections), `Judge` (schema as true system message via a new optional `system` port field, strict parse with fence tolerance, one re-ask on unparseable replies, 30s abort budget, records on every path), `SchemaSource` (memoized fs boundary), `Runner`, `JestBinding` (inert single registration, validated options), lazy composition root in `src/api`. 115 tests, zero network/timers.

**Deviation resolved during verification:** the implementation subagent had concatenated the schema into the user prompt (port had no system channel) — violating AD-7 and diverging from Story 1.3's validated setup. Fixed with an additive `system` field on `CompletionRequest`; the adapter now sends a real system message.

**Review breakdown:** 12 patched (2 high: payload section-forgery, unrecorded parse failures), 2 deferred (CJS/bundler root-walk → 3.3 e2e; injectGlobals:false → 3.6), 4 rejected. `followup_review_recommended: true` — patch volume touched judging semantics, the port, and the schema format.

**Note on schema change:** the fencing update to `schemas/coherent.md` post-dates Story 1.3's 60-call validation (unfenced sections), so the conformance matrix was RE-RUN live with the fenced format: 36/36 strict-JSON + correct verdicts across all three judge models (3 reps × 4 cases × 3 models, ~$0.05). No residual risk.

**Verification:** lint ✓ typecheck ✓ 115/115 (0.5s, zero network/timers) ✓ build ✓; conventions grep-clean.
