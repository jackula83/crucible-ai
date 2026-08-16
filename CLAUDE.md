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