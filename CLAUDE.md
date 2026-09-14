# CLAUDE.md

Run at session start:

/caveman ultra

## Development rules

- TDD mandatory for all implementation: red-green-refactor; a failing test
  precedes every piece of `src/` behavior. Scaffold/config files (package.json,
  tsconfig, CI yaml) exempt.
- Mock boundaries only (network, filesystem, clock, provider APIs); prefer real
  collaborators everywhere else.
- When a consumer/dependency does not yet exist, bind to its spec (port
  interface + contract tests) — never ship stub implementations in `src/`.

## Collaboration rules

- PR comments/replies posted via `gh` go out under Jack's account — always
  prefix them with `🤖 Claude's reply:` so authorship is clear.
- Only resolve a review thread when the fix is applied and unambiguous. If the
  reply asks a question, offers options, or interprets an unclear comment,
  leave the thread OPEN for Jack to resolve.

## Testing rules

- Tests live NEXT to the code they test (`config.test.ts` beside `config.ts`).
  Never use `__tests__` folders.
- Tests cover FUNCTIONAL requirements only — observable behavior a user of the
  module depends on. Implementation tests are never tolerated. Forbidden:
  - asserting something is a function / shape checks (`typeof x`)
  - asserting error message text (assert error TYPE/kind only)
  - testing import/export surface or module wiring
  - touching real `process` state (env, cwd, instrumentation/proxies)
  - writing or modifying real files (temp dirs included)
- Boundaries (fs, env, network, clock) are injected and faked in tests; pure
  logic is tested through the module's behavior, not its internals.
- Fakes/test doubles live ONE PER FILE under the area's `test/` folder with a
  `.fake.ts` suffix (e.g. `src/core/test/scripted-adapter.fake.ts`); enums in
  `.enum.ts` files; shared helpers in `.harness.ts` files. Never a monolithic
  fakes file, never inline in a test file.
- All test helper functions belong to a class — no loose module-level helper
  functions; no `readonly` modifiers in test helpers. Harness classes live in
  the area's `test/` folder as `<name>-harness.util.ts` with a specific class
  name (`ReportHarness`), never inline in the test file; shared test utilities
  are `<name>.util.ts` (e.g. `capture.util.ts`).
- Pure utility/formatter classes in src carry the `.util.ts` suffix
  (`reporter.util.ts`, `payload-assembler.util.ts`).
- No magic values in tests: model names and other repeated literals go into
  enums/named constants in their own files.
- Never assert identity/shape fields (`.name`, `.envVar`, instanceof a
  concrete class) — that is implementation testing.
- Assert OUTCOMES, not interactions: no captured-request inspection, no
  call/wait counters, no cause-identity piles. One purpose per test; assert
  only that purpose (error kind + the single behavior under test). Wire-shape
  correctness belongs to e2e against the real provider, not unit fakes.
- No test-induced design damage in implementation: never name or shape
  production code around tests (no `real*` names, no loose module functions —
  fold defaults into private static class members).
- No code comments. Needing a comment means the code is not clear enough —
  fix the naming/structure instead.
- Prefer `type` over `interface` — everywhere, src and tests.
- Named exports only, grouped at the END of the file (`export { thing };`).
  No inline `export` keywords, no default exports. Sole exception:
  tool-mandated config files (jest/tsdown) whose contract requires a default
  export.
- Public programmable interface may expose plain functions; everything
  internal to the framework is OOP — classes with injected collaborators, not
  module-level mutable state or free-function modules.
- ONE class per file, named after the class in kebab-case. Shared types/
  constants two classes need go in their own module, never a runtime cycle.
- The exposed surface lives in `src/api/`; internals stay out of that folder.
  The entry point re-exports only from `src/api/`.