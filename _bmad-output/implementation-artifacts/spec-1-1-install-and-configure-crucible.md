---
title: 'Story 1.1 — Install and configure Crucible'
type: 'feature'
created: '2026-08-16'
status: 'in-review'
baseline_revision: '8948ed3c5a52f0f0ad6eab4ed3198c4a0869e36b'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/1-1-install-and-configure-crucible.md'
  - '{project-root}/CLAUDE.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** crucible-ai is greenfield — no package exists. Every later story needs the scaffold, a fail-fast config subsystem, and the provider-port spec to bind against.

**Approach:** Scaffold a TS 6.x / Node >=22 / tsdown dual ESM+CJS package with Jest 30 unit tests and PR-lane CI; implement the `CrucibleError` base, the provider port spec + registry, and a memoized `config.get()` that validates `crucible.config.json` and resolves the adapter singleton + `effectiveVerbosity`. TDD throughout; the OpenRouter adapter itself is Story 1.2's unit — this story ships only its spec.

## Boundaries & Constraints

**Always:** TDD red-green-refactor — failing test precedes every piece of `src/` behavior (scaffold/config files exempt). Mock boundaries only (fs, env); real collaborators elsewhere. Kebab-case filenames. No `console.*` anywhere. Env access only in `core/config`. Dependency direction: only `core/config` calls `providers/registry`; core never imports adapters/bindings. Importing/registering never loads config (lazy memoized `get()` only). One `crucible` namespace. Jest = peerDependency, never dependency.

**Block If:** TS 6.x + Jest 30 toolchain cannot be made to run tests at all (both ts-jest and @swc/jest fail) — do not silently downgrade TypeScript major.

**Never:** No `openrouter.ts` or any provider implementation in `src/` (Story 1.2). No runner/judge/state/report modules (Stories 1.4–1.5). No `testDefaults` config key — reject as unknown field (Story 2.5). No API-key fields in config. No provider/network traffic in unit tests. No main-merge e2e CI lane (Story 3.5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid config | `{provider, model, meta?, verbosity?}` at root; provider registered | Frozen `{provider: adapter singleton, model, meta, effectiveVerbosity}`; 2nd `get()` = same instance | No error expected |
| Unknown provider | `provider: "nope"` | — | `CrucibleError` kind `config`, names bad value + lists registered providers |
| Missing model / empty | `model` absent or `""` | — | `config` error, actionable |
| Malformed / missing file | bad JSON or no file | — | `config` error naming file path + fix |
| Key-like field | `apiKey`/`api_key`/`key`/`token` present | — | `config` error directing to provider env var |
| Unknown field | e.g. `testDefaults` | — | `config` error naming the unknown field |
| Env override | `CRUCIBLE_VERBOSE=full`, config `verbosity: "default"` | `effectiveVerbosity = "full"` (env wins); no env, no config → `"default"` | Invalid env value → error naming valid levels (`default\|full\|debug`) |
| Inert import | no config file present | `import 'crucible-ai'` succeeds; namespace members exist | Unimplemented members throw `usage` on call only |

</intent-contract>

## Code Map

All files NEW (greenfield):

- `package.json` -- name `crucible-ai`, `type: module`, engines >=22, dual `exports` (types first; `require` → `.cjs`), Jest 30 peerDep, scripts lint/typecheck/test/build
- `tsconfig.json` -- TS 6.x (strict default-on), NodeNext
- `tsdown.config.ts` -- entry `src/index.ts`, `format: ['esm','cjs']`, dts
- `jest.config.ts` + transform -- ts-jest; fall back to `@swc/jest` if ts-jest rejects TS 6 (internal-only choice)
- `eslint.config.js` -- ESLint 9 flat + typescript-eslint
- `.github/workflows/ci.yml` -- PR lane: lint+typecheck+unit, Node 22/24 matrix, zero secrets
- `Makefile` -- `e2e-core`/`e2e-ext`/`e2e` stub targets (echo not-implemented)
- `src/index.ts` -- `crucible` namespace shell; members throw `usage` "coming in Story 1.4"; import is side-effect-free
- `src/core/errors.ts` -- `CrucibleError` base, `kind: 'config'|'usage'|'infra'`, infra carries `retryable` + cause fields
- `src/core/config.ts` -- memoized lazy `get()`; validation per I/O matrix; `effectiveVerbosity` resolution; sole env-access point
- `src/providers/types.ts` -- port SPEC: `complete(request, signal: AbortSignal): Promise<string>`, `envVar` declaration, retryable/fatal classification hook shape
- `src/providers/registry.ts` -- `register(name, adapter)` + resolve; called only by `core/config`
- `src/**/__tests__/*.test.ts` -- unit tests (fake adapter registered in test setup; temp-dir config fixtures; save/restore `process.env`)

## Tasks & Acceptance

**Execution:**
- [x] Scaffold files (`package.json`, `tsconfig.json`, `tsdown.config.ts`, `jest.config.ts`, `eslint.config.js`, `Makefile`, dir layout incl. empty `schemas/`, `e2e/core`, `e2e/ext`, `docs/`) -- TDD-exempt -- everything else needs a runnable toolchain
- [x] `src/core/errors.ts` -- TDD: kind discrimination, instanceof, message passthrough -- error taxonomy used by all stories
- [x] `src/providers/types.ts` + `src/providers/registry.ts` -- TDD with spec-conforming fake adapter: register/resolve, unknown-name error -- the seam Story 1.2 implements against
- [x] `src/core/config.ts` -- TDD: full I/O matrix -- fail-fast before judge spend
- [x] `src/index.ts` -- TDD: inert-import test (no config read on import), `usage` throw on unimplemented member call -- AD-9 registration inertness
- [x] `.github/workflows/ci.yml` -- PR lane only -- AR10

**Acceptance Criteria:**
- Given a fresh clone with deps installed, when `npm run lint && npm run typecheck && npm test && npm run build` run, then all pass and `dist/` contains both ESM and CJS entries with type declarations.
- Given the built package, when `package.json` is inspected, then Jest appears only under `peerDependencies` and `files` excludes e2e/fixtures/local config.
- Given no `crucible.config.json`, when the package is imported, then no error is thrown and no env/config access occurs.
- Given the CI workflow file, when a PR triggers it, then lint+typecheck+unit run on Node 22 and 24 with no secrets referenced.

## Spec Change Log

## Review Triage Log

### 2026-08-16 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 16: (high 0, medium 3, low 13)
- defer: 1: (high 0, medium 1, low 0)
- reject: 9: (high 0, medium 0, low 9)
- addressed_findings:
  - `[medium]` `[patch]` `CrucibleError`/`CrucibleErrorKind` + port types not exported from public entry — re-exported from `src/index.ts`, test added
  - `[medium]` `[patch]` CJS consumers got ESM-flavored types — exports map now per-condition (`import`/`require` each with own `types` → `.d.ts`/`.d.cts`)
  - `[medium]` `[patch]` `CRUCIBLE_VERBOSE=""` hard-failed config load — set-but-empty env now treated as unset, test added
  - `[low]` `[patch]` key-like guard case-sensitive + narrow — now case-insensitive, added `secret`/`authorization`, tests added
  - `[low]` `[patch]` registry allowed silent overwrite + name/adapter.name mismatch — both now `usage` errors, tests added
  - `[low]` `[patch]` registry error hardcoded `crucible.config.json` (layering leak) — filename dropped from message
  - `[low]` `[patch]` non-ENOENT read failure reported as "create the file" — errno distinguished, test (EISDIR) added
  - `[low]` `[patch]` UTF-8 BOM broke JSON parse — BOM stripped, test added
  - `[low]` `[patch]` whitespace-only provider/model passed validation — trimmed check, tests added
  - `[low]` `[patch]` `jest.config.ts` needed a TS loader absent on Node 22.0–22.17 — converted to `jest.config.mjs`
  - `[low]` `[patch]` CI PR-only (main never re-validated), no permissions/concurrency — added `push: main` trigger, `permissions: contents: read`, concurrency cancellation
  - `[low]` `[patch]` Makefile e2e stubs exited 0 (false green) — stubs now exit 1
  - `[low]` `[patch]` publish unguarded — `prepublishOnly` runs lint+typecheck+test+build
  - `[low]` `[patch]` port abort semantics unspecified — documented on `complete()` (aborted → reject with abort reason; runner discards; classifyFailure not consulted)
  - `[low]` `[patch]` `.gitignore` missing `coverage/` — added

## Design Notes

- Port spec + contract tests are the consumer-facing frontend: registry/config tests bind to a fake implementing `providers/types.ts` exactly; Story 1.2's real adapter must pass the same contract tests unchanged.
- `config.get().provider` IS the resolved adapter — downstream code never touches the registry.
- tsdown with `type: module`: CJS output gets `.cjs` extension; every `exports` entry orders `types` → `import` → `require`.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0, TS 6.x strict
- `npm test` -- expected: all unit tests green, zero network
- `npm run build` -- expected: dist/ ESM+CJS+d.ts emitted
- `node -e "import('crucible-ai').then(()=>console.log('inert-ok'))"` (from a pack-installed temp dir, or equivalent test) -- expected: `inert-ok` with no config file present

## Auto Run Result

**Summary:** Story 1.1 implemented — greenfield package scaffold (TS 6.0.3 strict, Node >=22, tsdown dual ESM+CJS, Jest 30 + ts-jest, ESLint 9 flat, PR/main CI), `CrucibleError` taxonomy, provider port spec + registry (spec-first: fake adapter in tests only, no shipped provider), and fail-fast memoized `config.get()` with full validation + `effectiveVerbosity` (env > config > default). TDD followed: 61 unit tests, all behavior test-first.

**Files changed (all new):**
- `package.json` / `package-lock.json` — package manifest: dual per-condition exports, Jest peer dep, prepublishOnly guard
- `tsconfig.json`, `tsdown.config.ts`, `jest.config.mjs`, `eslint.config.js`, `Makefile` (failing e2e stubs), `.github/workflows/ci.yml` (PR + main lanes, least-privilege, concurrency)
- `src/index.ts` — frozen `crucible` namespace (members throw `usage` until 1.4); re-exports `CrucibleError` + port types; side-effect-free import
- `src/core/errors.ts` — `CrucibleError` base (`config|usage|infra`, `retryable` for infra)
- `src/core/config.ts` — memoized lazy load, validation per I/O matrix, sole env-access point
- `src/providers/types.ts` — provider port SPEC (Story 1.2 implements against it; abort semantics documented)
- `src/providers/registry.ts` — register/resolve with duplicate + name-mismatch guards
- `src/{__tests__,core/__tests__,providers/__tests__}/*` — 61 tests incl. spec-conforming fake adapter
- `.gitignore` — coverage/ added
- Workflow artifacts: `epic-1-context.md`, this spec, `deferred-work.md`

**Review findings breakdown:** 16 patched (3 medium, 13 low — behavioral fixes applied TDD), 1 deferred (document meta-key gotcha in Story 3.6 docs), 9 rejected as noise. 0 intent gaps, 0 bad-spec loopbacks.

**Follow-up review recommendation:** true — patched-finding volume was high and touched the public API surface (error exports, exports-map typing) and CI posture; an independent pass is cheap insurance.

**Verification performed:** `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (61/61, zero network, 0.7s), `npm run build` ✓ (`dist/index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`), `make e2e-core` exits 1 as designed. Conventions verified by grep: no `console.*` in src, `process.env` only in `core/config.ts`, no provider implementation shipped.

**Residual risks:** ts-jest officially targets TS 5.x but runs clean against TS 6.0.3 today — pin drift could break tests (watch on upgrades). `meta` passthrough can carry committed secrets (deferred to docs). Node 24 lane unexercised locally (CI will cover).
