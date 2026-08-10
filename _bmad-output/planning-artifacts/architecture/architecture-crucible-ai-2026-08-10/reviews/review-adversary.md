# Adversarial Review — ARCHITECTURE-SPINE.md (crucible-ai)

**Reviewed:** `ARCHITECTURE-SPINE.md` (2026-08-10 draft)
**Method:** Constructed two units one level down and attempted to build them by independent agents, each obeying every AD and convention to the letter, then checked whether they compose:

- **Epic A — Execution** owns `bindings/jest.ts`, `core/runner.ts`, `core/aggregate.ts`, `core/report.ts`
- **Epic B — Judgment** owns `core/state.ts`, `core/judge.ts`, `core/config.ts`, `providers/*`

Both epics can be built fully AD-compliant and still be mutually incompatible at ten seams. Each hole below names the seam, the two legal-but-clashing readings, and the AD fix.

**Verdict: NOT build-ready for parallel/independent construction.** The ADs pin module boundaries and dependency direction well, but almost no seam pins the *shape* or *ownership* of what crosses it. Ten holes; the fixes are one new AD (run-record contract) plus tightenings to AD-3/4/5/7/8/9/10 and one convention row.

---

## H1 — Who throws, who formats, at the runner→binding seam

**Seam:** `bindings/jest.ts` ↔ `core/runner.ts` — what does the binding receive back: thrown error or result object? Who formats the failure message?

**Reading A (Epic A, binding-formats):** `runner.execute()` returns an `AggregateResult`; `bindings/jest.ts` inspects it and throws its own `Error` with a message it formats. Legal: AD-2 allows binding→core; AD-3 only says "a single thrown failure" reaches the framework — it never says who throws.

**Reading B (Epic B, runner-throws):** `runner.execute()` throws a `CrucibleError` directly on fail/errored; the binding body is a one-liner. Also legal.

**Clash:** Built together you get either double formatting, or a binding waiting for a return value from a function that throws. Worse, Reading A violates the *spirit* of AD-10 (binding formatting user-facing text) while violating no letter — the spine never says whether a thrown error's `.message` counts as "user-facing output."

**Fix (tighten AD-3 + AD-10):** `core/runner.execute()` resolves on pass and throws `CrucibleVerdictError` on fail/errored; its `.message` is produced exclusively by `core/report.renderVerdict(aggregate)`. Bindings never inspect, classify, or format — the entire binding body is `it(name, () => runner.execute(body, opts))`. State explicitly: a thrown failure message IS user-facing output under AD-10.

## H2 — Run-status classification is unpinned (expect-throw vs infra-throw vs user-throw)

**Seam:** run body ↔ `core/runner` status assignment feeding AD-4's three zones.

Under AD-6, a false verdict surfaces as a native `expect(...).toBe(true)` throw inside the run body. Under AD-7/AD-8, exhausted-retry infra failures surface as a thrown `CrucibleError`. The runner sees only "body rejected" and must map rejections to `failed | errored`.

**Reading A (Epic A):** anything not `instanceof CrucibleError` → `failed` (assertion errors, user `TypeError`s, user's own non-crucible `expect` failures — all semantic fails).

**Reading B (Epic B):** only framework assertion errors → `failed`; any unexpected throw (user code `TypeError`, `undefined` deref) → `errored`, since it's "not a semantic verdict" per AD-7's spirit.

**Clash:** Same test, same throws, different zone → different CI verdict under AD-4. Also unaddressed: user code that `catch`es the judge's infra error and continues.

**Fix (tighten AD-4):** add the classification rule: a run is `passed` iff its body resolves; a rejection carrying `CrucibleError` with `kind: 'infra'` → `errored`; **any other rejection** (framework assertion error, user exception) → `failed`. Infra errors thrown by the judge must be re-thrown by user code or the run is whatever the body's settlement says — document that swallowing them converts the run to its natural outcome.

## H3 — Judge reasoning has no home; multi-assertion attribution impossible

**Seam:** `core/judge` → `core/report`. AD-6 pins the judge's return type to `Promise<boolean>`. AD-10's `default` level must print "first judge error per failing run," and `full` must print "all judge output." Where does `reasoning` live between judge call and report time? And with multiple assertions in one body, how does the report name *which* assertion failed?

**Reading A (Epic B, print-and-forget):** judge calls `report.judgeVerdict(...)` immediately per completion (core→core, legal per AD-2), then returns the bare boolean; nothing is retained. Interleaved garbage under 20 parallel runs; aggregate-time reporting impossible.

**Reading B (Epic A, record-and-render):** judge returns boolean only; runner is somehow expected to have per-assertion verdict records at aggregate time — but nothing obligates the judge to record them, so Epic A's reporter reads an empty list.

**Clash:** Epic B ships a judge that discards reasoning; Epic A ships a reporter that requires retained per-assertion records. Both AD-compliant. FR-8 output is unimplementable.

**Fix (new AD-13, run-record contract):** before resolving its boolean, `core/judge` appends `VerdictRecord { assertion, claim, verdict, reasoning, seq }` (and on infra failure, `ErrorRecord { cause, attempts }`) to the ambient run context (see H4). `core/report` renders exclusively from the aggregate of these records at verdict time; no output is emitted mid-run at `default` level.

## H4 — Two owners of the ALS store; two shapes for it

**Seam:** `core/state.ts` ↔ `core/runner.ts` ↔ `core/judge.ts` — who owns the `AsyncLocalStorage` instance, what shape is `freshStore`, and does the judge get state by direct import or passed in?

**Reading A (Epic B):** `state.ts` owns the ALS; per conventions, the store is exactly `string[]` (append-only). Judge imports `state.current()` directly.

**Reading B (Epic A):** AD-5 says "the runner wraps each run body in `AsyncLocalStorage.run(freshStore, body)`" — so `runner.ts` owns the ALS; and per H3 the store must also hold verdict records and run status, so `freshStore` is a rich `RunContext` object. Judge receives state as a parameter from the assertion wrapper.

**Clash:** two ALS instances (state resolves against one, runner scopes the other — every `crucible.load` hits the fail-fast "outside run scope" error), and two store shapes (`string[]` vs `RunContext`). Both readings satisfy AD-5 verbatim; the conventions row "State = `string[]`" actively misleads Epic B.

**Fix (tighten AD-5 + convention):** `core/state.ts` exports the single ALS holding `RunContext { state: string[]; verdicts: VerdictRecord[]; errors: ErrorRecord[] }`; runner enters scope only via `state.enterRun(body)`; judge and assertion functions access state only through `state` accessors (direct import, never passed in). Convention row becomes "user state = `string[]` field of `RunContext`, append-only."

## H5 — `need = ⌈threshold × runs⌉` is itself floating-point and bumps

**Seam:** `core/aggregate.ts` — AD-4 forbids comparing pass *ratios* in floating point, then defines `need` by a floating-point multiply.

**Reading A (naive, letter-compliant):** `need = Math.ceil(threshold * runs)`. In IEEE-754, `0.35 * 20 === 7.000000000000001`, so `need = 8` — a test with 7/20 passes at threshold 0.35 **fails** though exactly at threshold.

**Reading B (epsilon-corrected):** `need = Math.ceil(threshold * runs - 1e-9)` → `need = 7`, passes.

**Clash:** two AD-4-compliant aggregates disagree on the verdict of identical run data. Cross-language shells (AD-5's contract mindset) will diverge the same way. Also unpinned: `threshold: 0` gives `need = 0` → pass with zero evidence, even with 20/20 errored runs — "CI green without evidence," the exact thing AD-4 claims to prevent.

**Fix (tighten AD-4):** pin the exact formula — `need = Math.ceil(threshold * runs - 1e-9)` (or integer math on threshold scaled to 10^6) — as the normative cross-language computation, and pin the domain: `threshold ∈ (0, 1]`, with `threshold` such that `need ≥ 1`; reject `0` at config/call validation.

## H6 — Provider port return type: who parses the strict JSON?

**Seam:** `providers/types.ts` ↔ `core/judge.ts`. AD-8 says an adapter "sends a judge request"; AD-7 says the reply must be strict JSON `{verdict, reasoning}`. Neither says what type crosses the port.

**Reading A (Epic B, adapter-parses):** port returns `Promise<Verdict>`; the OpenRouter adapter parses and validates JSON. Legal — parsing looks like transport.

**Reading B (Epic A/portability, judge-parses):** port returns `Promise<string>` (raw completion text); judge parses, so "unparseable → retryable infra error" is one behavior for all adapters. Also legal — and AD-8's "prevents: per-adapter verdict formats" hints at it without requiring it.

**Clash:** type error at the port; worse, if adapters parse, each adapter classifies unparseable output its own way, quietly re-creating per-adapter verdict behavior.

**Fix (tighten AD-8):** the port method is `complete(request, signal): Promise<string>` returning raw completion text; JSON parsing, validation, and unparseable→retryable classification live only in `core/judge`. Adapters never see verdict semantics.

## H7 — "Fatal aborts the whole test immediately" is unimplementable as specced

**Seam:** `core/runner` (Promise.all over N bodies) ↔ provider port. AD-8: fatal error aborts the whole test immediately. AD-3: runs execute concurrently via `Promise.all`.

**Reading A (Epic A):** fatal → that run rejects → `Promise.all` rejects → test thrown. But the 19 sibling runs keep executing unawaited, burning provider spend and printing stray output after the verdict — "immediately" in name only, and it violates AD-8's own stated purpose ("auth failures burning 20 runs").

**Reading B (Epic B):** runner threads an `AbortController` into judge calls so siblings cancel — but the AD-8 port contract ("exactly: send, classify, declare env var") contains no abort signal, so Epic B's adapter signature `send(req, signal)` doesn't typecheck against Epic A's port, and adding it arguably violates "implements exactly."

**Clash:** incompatible port signatures; or a compliant build that doesn't do what AD-8 promises.

**Fix (tighten AD-8):** port signature includes `AbortSignal` (see H6); runner owns one `AbortController` per test, aborts on first `fatal` classification, treats in-flight aborted runs as discarded (not errored, not failed), and throws the fatal immediately.

## H8 — "Loaded once per process at first crucible API use" — which use?

**Seam:** `core/config.ts` trigger point, and who calls `providers/registry`.

**Reading A:** `crucible.it()` *registration* is the first API use → config loads and validates during Jest's collection phase; a malformed config fails suite collection (every file errors, even ones not running crucible tests this session).

**Reading B:** config loads lazily at first run *execution*; registration is inert. Different failure UX, different "fail fast before any provider call" timing — both satisfy AD-9.

Second ambiguity: who resolves the adapter? Config epic validates the provider *name* and judge calls `registry.resolve()` per assertion; or config load itself resolves the adapter once. Two epics both "fail fast on unknown provider" in different places → double, divergent validation.

**Fix (tighten AD-9):** registration is inert (stores options only); `config.get()` is memoized and first invoked at execution of the first run; config load itself calls `providers/registry` so unknown-provider is a load-time failure and `config.get().provider` is the resolved adapter singleton. Judge never touches the registry.

## H9 — `CRUCIBLE_VERBOSE`: AD-10 contradicts the conventions table

**Seam:** `core/report` env access. AD-10: report "enforces the verbosity ladder: config default, `CRUCIBLE_VERBOSE` env override wins" — a team building report.ts from AD-10 reads `process.env` there. Conventions row: "env access only in config + adapter key lookup" — a team building config.ts owns the env read and expects report to consume a resolved value. First reading violates the convention; second violates AD-10's literal assignment of enforcement to report. Internal contradiction, so both epics are "compliant" against the text each read.

**Fix (tighten AD-10):** config computes `effectiveVerbosity` (env override applied) at load; report consumes it and only enforces the ladder's *filtering*. AD-10's wording changes from "report enforces… env override" to "report filters by the effective verbosity resolved in config."

## H10 — "No second entry point" vs reserved subpath export vs Jest as dependency

**Seam:** `src/index.ts` ↔ `bindings/jest.ts` packaging. Conventions: "no second entry point." Deferred: "`bindings/` seam + subpath export reserved" (a second entry point). And if `index.ts` statically imports `bindings/jest.ts`, Jest becomes a hard runtime dependency of every consumer.

**Reading A:** single entry, static import of the Jest binding → `jest` in `dependencies`, breaks any non-Jest consumer and poisons the future Vitest story.

**Reading B:** binding behind `crucible-ai/jest` subpath → violates the convention as written today.

**Fix (tighten convention):** single public *namespace* (`crucible`), main entry re-exports it; `bindings/jest.ts` imports Jest's globals lazily inside `crucible.it` (peerDependency); subpath exports for future bindings are permitted — reword the convention from "no second entry point" to "one namespace; bindings may add subpath entries, never new namespaces."

---

## Summary of AD changes

| Hole | Action |
| --- | --- |
| H1 | Tighten AD-3/AD-10: runner throws `CrucibleVerdictError`, message rendered only by report; bindings are inert one-liners |
| H2 | Tighten AD-4: pin rejection→status taxonomy (infra `CrucibleError` → errored; all else → failed) |
| H3 | New AD-13: judge writes `VerdictRecord`/`ErrorRecord` to ambient run context; report renders only from records |
| H4 | Tighten AD-5 + convention: `state.ts` owns the single ALS with `RunContext`; access via accessors only |
| H5 | Tighten AD-4: pin exact epsilon-safe `need` formula; `threshold ∈ (0,1]`, `need ≥ 1` |
| H6 | Tighten AD-8: port returns raw `Promise<string>`; judge owns parsing |
| H7 | Tighten AD-8: port takes `AbortSignal`; runner aborts siblings on fatal; aborted runs discarded |
| H8 | Tighten AD-9: registration inert; memoized `config.get()` resolves adapter via registry at load |
| H9 | Tighten AD-10: config resolves `effectiveVerbosity`; report only filters |
| H10 | Reword convention: one namespace; lazy Jest peerDep; subpath entries allowed for bindings |
