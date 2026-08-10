# Currency Review — ARCHITECTURE-SPINE.md (crucible-ai)

**Review date:** 2026-08-10
**Lens:** Every committed decision verified against the live web rather than asserted from training data — versions, existence/fit of named technologies, EOL status.
**Verdict:** PASS WITH CORRECTIONS — the stack is broadly current and every named technology exists and fits, but the spine contains one factual error (TS 7.0 release date), one EOL support floor (Node 20), and one maintenance-status blind spot (tsup) that were not confirmed against the web.

---

## Item-by-item verification

### 1. TypeScript — "6.x (7.0 released 2026-08-05 — adopt post-MVP once tooling settles)"

**Status: PARTIALLY WRONG — date is incorrect; the pin itself is sound.**

- TypeScript 7.0 reached **GA on 2026-07-08**, not 2026-08-05. The RC shipped 2026-06-18. The spine's date appears to be an unverified assertion (possibly a transposition of 07-08).
- The "adopt post-MVP once tooling settles" hedge is well-founded and arguably understated: 7.0 ships **without a stable programmatic API**, so ecosystem tooling (bundlers, ts-jest-style integrations) must wait for 7.1. Staying on 6.x for MVP is the right call.
- Note: 7.0 makes strict mode and the 6.0 deprecations hard defaults — worth writing 6.x code strict-clean now to keep the deferred migration cheap. The spine's Deferred item covers the migration but not this forward-compat convention.

**Action:** Correct the date to 2026-07-08 and optionally note the 7.1 stable-API dependency as the concrete "tooling settles" gate.

### 2. Node.js — "engines `>=20`; CI matrix 20 / 22 / 24"

**Status: SHAKY — floor includes an EOL release line.**

- **Node 20 reached end-of-life on 2026-04-30** — over three months before this spine's date. No further security patches ship for the 20 line.
- Node 22: Maintenance LTS, EOL 2027-04-30. Node 24: Active LTS, EOL 2028-04-30.
- An `engines >=20` floor for a *library* is defensible as a compatibility courtesy, but the spine presents it without acknowledging 20 is EOL, and the CI matrix actively spends CI time validating an unsupported line. For a greenfield package there is no legacy-consumer pressure justifying it.

**Action:** Either raise engines to `>=22` with a CI matrix of 22 / 24 (recommended for greenfield), or keep `>=20` but state explicitly that 20 is EOL best-effort compatibility only. The current wording reads like 20 is a supported line — it is not.

### 3. Jest — "30"

**Status: CONFIRMED CURRENT.**

- Jest 30 is the current major (latest ~30.4.x as of August 2026; released June 2025).
- Compatibility cross-check: Jest 30's minimum TypeScript is 5.4 (TS 6.x fine) and it dropped only Node 14/16/19/21 — no conflict with the Node floor either way.

### 4. tsup — "8.x (build, dual ESM+CJS)"

**Status: TECHNICALLY CURRENT BUT SHAKIER THAN STATED — project is unmaintained.**

- 8.x is indeed the current major (latest 8.5.1), but the last publish was ~9 months ago and the maintainers state the project is **no longer actively maintained**, recommending **tsdown** as the successor.
- This matters twice over: (a) the spine's own Deferred item gates TS 7 adoption on "tsup/ts-jest ecosystem support settles" — tsup support for TS 7 may never arrive; (b) picking an abandoned bundler for a greenfield package bakes in a known future migration.
- tsup 8.x works fine today for a dual ESM+CJS library build, so this is not a blocker — but the spine asserts it as a neutral pin when it is a consciously-expiring choice.

**Action:** Either switch the pin to tsdown now (drop-in successor, same no-config esbuild/rolldown philosophy), or keep tsup 8.x with an explicit note that it is unmaintained and tsdown is the planned migration path alongside TS 7.

### 5. OpenRouter API — "chat completions, verified 2026-08-10"

**Status: CONFIRMED — claim checks out.**

- OpenRouter's OpenAI-compatible chat completions endpoint is live and current.
- AD-7's strict-JSON verdict requirement is well supported: OpenRouter offers `response_format: { type: "json_object" }` and strict `{ type: "json_schema", ... }` structured outputs. Caveat the spine doesn't mention: **structured-output support is per-model** — an unsupported model fails the request. Since users choose the model in `crucible.config.json`, the adapter should either treat that failure as `fatal` (it will recur all 20 runs) or fall back to prompt-enforced JSON with the existing parse-retry path. AD-8's taxonomy can absorb this, but the model-dependence is worth a line in the spine or the OpenRouter adapter story.

### 6. AsyncLocalStorage (AD-5)

**Status: CONFIRMED STABLE.**

- Stability 2 (Stable) in current Node docs; stable since 16.4.0. From Node 24 the internal implementation is the faster AsyncContextFrame with an unchanged API — the spine's reliance on `ALS.run(freshStore, body)` under parallel `Promise.all` is on solid, current ground on every Node line in the matrix.

### 7. GitHub Actions — CI + tag-triggered publish with npm provenance

**Status: CONFIRMED — standard, current practice.** Nothing pinned here that can rot; `npm publish --provenance` from Actions is the current recommended supply-chain pattern.

---

## Summary of required corrections

| # | Item | Severity | Fix |
| --- | --- | --- | --- |
| 1 | TS 7.0 GA date wrong (spine: 2026-08-05; actual: 2026-07-08) | Low (factual hygiene) | Correct date; gate on 7.1 stable API |
| 2 | Node 20 in engines floor + CI matrix despite EOL 2026-04-30 | Medium | Raise to `>=22` or label 20 as EOL best-effort |
| 3 | tsup pinned without noting it is unmaintained (tsdown is successor) | Medium | Switch to tsdown or document the expiry |
| 4 | OpenRouter structured outputs are per-model; spine silent on it | Low | Note model-dependence in AD-7/AD-8 or adapter story |

No named technology is nonexistent or fundamentally misfit. Jest 30, AsyncLocalStorage, OpenRouter chat completions, and the TS 6.x hold are all verified current as of 2026-08-10.

Sources: [InfoQ — TypeScript 7.0 released](https://www.infoq.com/news/2026/08/typescript-7-released/), [TypeScript 7.0 GA migration playbook](https://www.digitalapplied.com/blog/typescript-7-0-ga-native-compiler-migration-playbook-2026), [Node.js EOL](https://nodejs.org/en/about/eol), [HeroDevs Node.js EOL dates](https://www.herodevs.com/blog-posts/node-js-end-of-life-dates-you-should-be-aware-of), [Jest blog — Jest 30](https://jestjs.io/blog/2025/06/04/jest-30), [jest — npm](https://www.npmjs.com/package/jest), [tsup — npm](https://www.npmjs.com/package/tsup), [OpenRouter API reference](https://openrouter.ai/docs/api_reference/overview), [Node.js async_context docs](https://nodejs.org/api/async_context.html)
