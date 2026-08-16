# Story 1.1: Install and configure Crucible

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want to install crucible-ai and configure it via `crucible.config.json`,
so that misconfiguration fails fast with an actionable error before any judge spend.

## Acceptance Criteria

1. **Given** a fresh TS/Jest project with crucible-ai installed (scaffold: tsdown dual ESM+CJS build, TS 6.x strict, Node >=22, kebab-case layout per spine seed, CI workflow running lint+typecheck+unit) **When** a valid `crucible.config.json` (`provider`, `model`, optional `meta`, optional verbosity) exists at project root **Then** `config.get()` loads and validates it once (memoized), resolving the adapter singleton via `providers/registry` and `effectiveVerbosity` (env wins).
2. An unknown provider, missing model, or malformed file throws `CrucibleError` kind `config` with an actionable message at load — never mid-run.
3. Registration-time code paths never trigger config load (registration inert, AD-9).
4. No API key field is accepted in the config file (NFR1): a config containing a key-like field (e.g. `apiKey`, `api_key`, `key`, `token`) is rejected as a `config` error telling the user to use the provider's env var instead.

## Tasks / Subtasks

- [ ] Task 1: Scaffold the package (AC: 1)
  - [ ] `package.json`: name `crucible-ai`, `engines.node >=22`, `type: module`, dual `exports` (`import` → ESM, `require` → CJS `.cjs`), `files` limited to build output + `schemas/`, Jest 30 as **peerDependency** (never dependency — AR11)
  - [ ] `tsconfig.json`: TS 6.x, strict (default-on in TS 6), NodeNext module resolution
  - [ ] `tsdown.config.ts`: entry `src/index.ts`, `format: ['esm', 'cjs']`, dts on
  - [ ] Directory layout per Structural Seed: `src/index.ts`, `src/bindings/`, `src/core/`, `src/providers/`, `schemas/`, `e2e/core/`, `e2e/ext/`, `docs/`, `Makefile` (stub targets ok this story)
  - [ ] ESLint 9 flat config + typescript-eslint; scripts: `lint`, `typecheck` (`tsc --noEmit`), `test`, `build`
  - [ ] Jest 30 config for the package's own unit tests (see Dev Notes on TS transform choice)
- [ ] Task 2: Error base (AC: 2, 4)
  - [ ] `src/core/errors.ts`: `CrucibleError extends Error` with `kind: 'config' | 'usage' | 'infra'`; infra variants carry `retryable` flag + provider cause (fields used from Story 1.2 on)
- [ ] Task 3: Provider port spec + registry (AC: 1, 2)
  - [ ] `src/providers/types.ts` is the **spec** — the port config/registry code against: `complete(request, signal: AbortSignal): Promise<string>`, `envVar` declaration, retryable/fatal classification hook shape (AD-8). No provider implementation in this story.
  - [ ] `src/providers/registry.ts`: `register(name, adapter)` + resolve; maps config `provider` value → adapter singleton; unknown/unregistered value → `CrucibleError` kind `config` naming the bad value and listing registered providers; called **only** by `core/config` (AD-2)
  - [ ] Unit tests exercise registry/config through a **spec-conforming fake adapter** registered in test setup — no `openrouter.ts` file exists yet. `src/providers/openrouter.ts` is Story 1.2's complete unit of work, TDD'd against this same port spec.
- [ ] Task 4: Config subsystem (AC: 1, 2, 3, 4)
  - [ ] `src/core/config.ts`: `config.get()` — reads `crucible.config.json` from project root (`process.cwd()`), validates, memoizes; returns frozen `{ provider /* resolved adapter singleton */, model, meta, effectiveVerbosity }`
  - [ ] Validation: `provider` required string resolvable by registry; `model` required non-empty string; `meta` optional object passed through untouched (FR7); `verbosity` optional, one of `default | full | debug`; key-like fields rejected (AC 4); unknown other fields rejected with "did you mean" style actionable message
  - [ ] `effectiveVerbosity`: `CRUCIBLE_VERBOSE` env var (if set, must be a valid level) > config `verbosity` > `'default'`. Env access lives ONLY here + adapter key lookup (AR12)
  - [ ] Malformed JSON / missing file → `CrucibleError` kind `config` with the file path and what to fix
  - [ ] Nothing in module top-level scope loads config — memoized lazy `get()` only (AD-9: first invoked at first run execution)
- [ ] Task 5: Public namespace shell (AC: 3)
  - [ ] `src/index.ts`: export a `crucible` namespace object (single namespace — AR11); stub members may throw `usage` "coming in Story 1.4" but importing/registering must not touch config or env
- [ ] Task 6: Unit tests (AC: all) — written test-first per TDD (see Dev Notes)
  - [ ] Valid config (provider = fake registered in test setup) → resolved adapter + effectiveVerbosity; second `get()` returns same instance (memoization)
  - [ ] Unknown provider / missing model / malformed JSON / missing file → `config` error, message names the problem
  - [ ] Key-like field → rejected with env-var guidance
  - [ ] `CRUCIBLE_VERBOSE=full` overrides config `verbosity: "default"`; invalid env value rejected naming valid levels
  - [ ] Importing `crucible-ai` with no config file present does NOT throw (proves inert registration)
  - [ ] No provider traffic anywhere in unit tests (AR10 PR lane = zero spend)
- [ ] Task 7: CI (AC: 1)
  - [ ] `.github/workflows/ci.yml`: PR lane — lint + typecheck + unit on Node 22 and 24 matrix; NO provider secrets, no e2e (AR10). Main-merge e2e lane is Story 3.5 — do not add it here

## Dev Notes

### TDD — mandatory (applies to this and every story)

- Red-green-refactor per task: write the failing test first, implement to green, refactor. No implementation code before a failing test exists for it.
- The port spec (`providers/types.ts`) + its contract tests are the frontend other units code against — Story 1.2 implements `openrouter.ts` against the identical spec/contract tests. No stubs shipped in `src/` to satisfy another story's dependency; test doubles live in test code only.
- Scaffold config files (package.json, tsconfig, CI yaml) are exempt from test-first; all behavior in `src/` is not.

### Architecture constraints (binding — violations are defects)

- **AD-2 dependency direction**: core never imports adapters/bindings; only `core/config` calls `providers/registry`; adapters and bindings never import each other. Enforce by convention now; structure imports so a lint rule can gate later.
- **AD-9 config & secrets**: `config.get()` memoized, first invoked at first run execution — never at registration/import. Config load resolves the adapter singleton (`config.get().provider` IS the adapter — downstream judge code never touches the registry). API keys only from the adapter's declared env var; `CRUCIBLE_` prefix reserved for crucible-owned settings.
- **AR12 conventions**: kebab-case filenames; no `console.*` anywhere in this story's code (only `core/report` may print, and it doesn't exist yet); env access only in `core/config` + adapter key lookup; "state" terminology, never domain vocabulary.
- **AR11 stack**: one `crucible` namespace; Jest reached lazily at call time (peer dep); future bindings via subpath exports only.
- **`testDefaults` config key is Story 2.5, NOT this story.** Design validation so adding a field later is one schema entry; if present now, reject it as unknown (fail-closed keeps 2.5's semantics clean).
- **Scope guard**: no runner, no judge, no state, no report modules this story — `crucible.it`/`coherent`/`load` are Stories 1.2–1.5. Stubs may exist only as `usage`-throwing placeholders on the namespace.

### Tech versions (researched 2026-08-16)

- **TypeScript 6.x** per spine (TS 7.0.2 is out but spine explicitly defers TS7 post-MVP). TS 6 flips `strict` on by default and defaults to ESM/es2025 target — don't fight the defaults, and don't add legacy flags TS 6 removed.
- **Jest 30** (min TS 5.4). ⚠️ ts-jest 29.4.x officially supports TS 5.x — if it chokes on TS 6, use `@swc/jest` for the package's own tests instead (transform choice is internal-only; the shipped library is built by tsdown, not Jest). Verify `yarn test` green before settling.
- **tsdown** (rolldown-based, tsup successor): `format: ['esm','cjs']` emits conditional-exports-ready output; every `exports` entry needs a `require` condition pointing at the `.cjs` file, `types` condition first.
- **Node >=22 engines**, CI matrix 22/24 (Node 20 EOL 2026-04-30).

### Config shape (normative example)

```json
{
  "provider": "openrouter",
  "model": "deepseek-v3",
  "meta": { "provider": "atlascloud", "reasoning": "minimal" },
  "verbosity": "default"
}
```

`meta` is opaque passthrough — never validate or transform its contents (FR7).

### Project Structure Notes

- Greenfield: repo currently has NO code (only planning docs + README/LICENSE). This story creates the entire scaffold — layout must match the spine's Structural Seed exactly (see architecture spine "Structural Seed" section).
- `crucible.config.json` at repo root will later hold the dogfood config (committable — hence the no-keys rule).
- `src/core/errors.ts` is an addition to the seed file list (seed names modules, not the error base); kebab-case, lives in core.

### Testing standards

- Unit tests colocated or under `src/**/__tests__` (pick one, be consistent — this story sets the precedent).
- Zero network in unit tests. Config tests use temp dirs / fixture JSON, not the repo root config.
- Env-var tests must save/restore `process.env` (no leakage between tests).

### References

- Epics: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.1; Additional Requirements AR1–AR13
- Architecture: `_bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md` — AD-2, AD-8, AD-9, AD-12, Consistency Conventions, Stack, Structural Seed
- PRD: `_bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/prd.md` — FR-7, §4.4 NFRs (keys via env)
- Readiness report: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-08-16.md` — minor item 1 (1.1↔1.2 seam; resolved spec-first: registry + port spec here, adapter wholly in 1.2)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
