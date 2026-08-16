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
- No code comments. Needing a comment means the code is not clear enough —
  fix the naming/structure instead.
- Named exports only, grouped at the END of the file (`export { thing };`).
  No inline `export` keywords, no default exports. Sole exception:
  tool-mandated config files (jest/tsdown) whose contract requires a default
  export.
- Public programmable interface may expose plain functions; everything
  internal to the framework is OOP — classes with injected collaborators, not
  module-level mutable state or free-function modules.
- The exposed surface lives in `src/api/`; internals stay out of that folder.
  The entry point re-exports only from `src/api/`.