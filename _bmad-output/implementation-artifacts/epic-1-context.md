# Epic 1 Context: First semantic assertion (walking skeleton)

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A developer can install crucible-ai, configure OpenRouter, and get a real semantic verdict inside a Jest test: `crucible.it()` in smoke mode (single run), `crucible.coherent(response, claim)`, a schema-driven judge, fail-fast configuration, the core retry taxonomy, and a minimal failure print that includes the judge's reasoning rather than a bare boolean. The epic exists to prove the product's core bet — evaluation semantics living in a portable markdown instruction schema, not in TypeScript — as early and cheaply as possible.

## Stories

- Story 1.1: Install and configure Crucible (DONE)
- Story 1.2: Reliable judge connectivity via OpenRouter
- Story 1.3: Design the `coherent` instruction schema (spike)
- Story 1.4: First semantic verdict (smoke mode)
- Story 1.5: See why it failed

## Requirements & Constraints

- Declaring an inference test with runs/threshold omitted registers exactly one Jest test whose body executes once (smoke mode); the test passes iff that run passes. Full runs/threshold aggregation belongs to Epic 2 — this epic only ships the declaration surface and single-run path.
- `crucible.coherent(response, claim)` resolves a boolean semantic verdict, asserted with Jest's native `expect` — no custom matchers. With no state loaded, the claim is judged against the response alone. Knowledge-boundary (anti-omniscience) claims are first-class. Canonical fixture: state places Jane and Bob apart; a response placing them together makes "they can't meet" resolve false, the inverse true.
- Each assertion type's evaluation procedure lives in a language-agnostic markdown instruction schema the judge executes; changing `coherent()` behaviour must require editing only its schema, never TypeScript.
- Provider, model, and provider-specific `meta` passthrough are configured in a committable `crucible.config.json`; an unsupported provider, missing model, or malformed file fails fast at config load with an actionable error — never mid-run, never after judge spend.
- API keys come only from provider-native environment variables (`OPENROUTER_API_KEY`); no key field is accepted in config. The `CRUCIBLE_` prefix is reserved for crucible-owned variables.
- Judge infrastructure failures (rate limit, timeout, provider 5xx, unparseable judge replies) are recorded as errored runs, never semantic failures; fatal errors (bad key, unknown model, 400/401) surface immediately without retry.
- Judge calls are metered spend: one stateless completion per assertion call, no judge traffic outside explicit test execution.
- On failure, output shows the claim, a bounded response excerpt, and the judge's reasoning; errored renders visually distinct from failed. Epic 1 ships a provisional print including reasoning; the full output contract and verbosity ladder are Epic 3.
- Judge false-negatives are an accepted limitation, mitigated by narrow single-claim assertions. The assertion-selection doctrine applies: use the narrowest assertion that expresses the claim — plain framework assertions when the value is programmatically accessible, judge-extraction assertions (post-MVP `exact()`/`range()`) for embedded targets, `coherent()` only for inherently semantic claims. Judge latitude is a cost spent only when needed; this doctrine, not judge-unreliability evidence, justifies the post-MVP narrower rungs. `coherent()` is the only MVP assertion, and docs must eventually teach the ladder.

## Technical Decisions

**Architecture (spine invariants relevant to this epic):**
- Two-part split: deterministic TypeScript shell vs portable non-deterministic core in `schemas/*.md`. TypeScript maps calls to schemas, orchestrates, and transports verdicts — never encodes judgment.
- Ports-and-adapters layout: `src/bindings/` → `src/core/` → provider port; adapters implement the port. Core never imports adapters or bindings; only the registry resolves adapters, and only config calls the registry.
- Registration is inert: `crucible.it()` stores options and registers one framework test; config loads memoized at first run execution, never at registration. Config load resolves the adapter singleton and effective verbosity (env overrides config).
- Judge = one stateless completion per assertion: schema as system prompt, user content = state + response + claim, strict JSON `{verdict, reasoning}` reply. Parsing and the unparseable-is-retryable classification live only in the core judge module.
- Provider port: `complete(request, AbortSignal): Promise<string>` returning raw text — adapters never see verdict semantics. Adapters classify failures retryable (429/timeout/5xx) vs fatal (400/401/unknown model) and declare their API-key env var. Core owns retry: max 3 attempts, exponential backoff with jitter, then the run is errored.
- Per-run ambient state: one AsyncLocalStorage holding `RunContext { state, verdicts, errors }`, accessed only through state accessors; the judge appends a verdict record before resolving; calling accessors outside a run scope is a fast usage error.
- Reporter owns all output: verdict failures throw `CrucibleVerdictError` whose message is rendered solely by the report module from run records; no `console.*` anywhere else.
- Schemas ship in the package, named per assertion (`coherent.md`), frontmatter carrying name and output contract, versioned by package version, free of TypeScript- or provider-specific instructions.
- Errors: one `CrucibleError` base with kind `config | usage | infra`; infra carries a retryable flag and provider cause.
- Stack: TypeScript 6.x strict, Node >=22 (CI matrix 22/24), Jest 30 as peer dependency reached lazily, tsdown dual ESM+CJS build, kebab-case files, one `crucible` namespace, "state" terminology never domain vocabulary. Env access only in config plus adapter key lookup.
- CI: PR lane = lint + typecheck + unit with zero provider traffic; e2e is out of this epic's scope.

**Binding CLAUDE.md development rules:**
- TDD mandatory: red-green-refactor; a failing test precedes every piece of `src/` behavior. Scaffold/config files exempt.
- Mock boundaries only (network, filesystem, clock, provider APIs); real collaborators everywhere else.
- When a consumer or dependency does not yet exist, bind to its spec (port interface plus contract tests) — never ship stub implementations in `src/`.

**Binding CLAUDE.md testing rules:**
- Tests live next to the code they test (`config.test.ts` beside `config.ts`); never `__tests__` folders.
- Tests cover functional requirements only — observable behavior a module's user depends on. Forbidden: shape/typeof checks, asserting error message text (assert error type/kind only), testing import/export surface or module wiring, touching real `process` state, writing real files (temp dirs included).
- Boundaries (fs, env, network, clock) are injected and faked in tests; pure logic is tested through module behavior, not internals.
- No code comments — fix naming/structure instead.
- Named exports only, grouped at the end of the file; no inline `export`, no default exports (sole exception: tool-mandated config files).
- Public programmable interface may expose plain functions; everything internal is OOP — classes with injected collaborators, no module-level mutable state or free-function modules.
- The exposed surface lives in `src/api/`; internals stay out of that folder; the entry point re-exports only from `src/api/`.

## Cross-Story Dependencies

- Story 1.1 is DONE: scaffold, ConfigStore + ConfigBoundary, ProviderRegistry, the provider port spec (`src/providers/types.ts`), and the FakeAdapter test double all exist. Later stories bind to these as-is; consult the code for their shapes.
- Story 1.2 (OpenRouter adapter) implements the existing port spec and plugs into the existing registry; core retry/abort behavior it exercises is shared with the runner work in 1.4.
- Story 1.3 (schema spike) deliberately involves no library code; its validated `schemas/coherent.md` artifact and model-behaviour notes are a hard prerequisite for Story 1.4, which binds the judge to that exact file.
- Story 1.4 depends on 1.1 (config/registry), 1.2 (working adapter), and 1.3 (schema); it establishes the run scope and verdict records that Story 1.5's reporting renders from.
- Story 1.5 consumes 1.4's records and error taxonomy; it ships a provisional failure print that Epic 3 (full output contract, verbosity ladder) later completes — do not gold-plate reporting here.
- Epic 2 completes runs/threshold aggregation, state load/append, and sibling abort on the seams this epic creates (run scope, port abort signal, three-zone classification); Epic 3 completes diagnostics, docs, e2e, and publish.
