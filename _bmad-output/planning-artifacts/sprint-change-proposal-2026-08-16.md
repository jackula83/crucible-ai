# Sprint Change Proposal — 2026-08-16

**Project:** crucible-ai
**Status:** Approved and applied 2026-08-16
**Scope classification:** Minor (direct implementation)

## 1. Issue Summary

During creation of Story 1.1 (2026-08-16), the draft included a shipped stub `openrouter.ts` to satisfy the 1.1↔1.2 seam — a pattern the implementation-readiness report had recommended. Jack rejected this as waste and surfaced a broader gap: no project artifact encodes the development process rules (TDD, mocking discipline, seam handling), so downstream agents will keep producing stub-shaped seams and untested-first code.

**Category:** New process requirement.
**Evidence:** Story 1.1 v1 Task 3 (stub adapter); readiness report minor item 1 (recommended the stub); epics AR1–AR13 and architecture spine conventions contain no process/TDD guidance.

## 2. Impact Analysis

- **Epic impact:** None structural. Epic 1 completable unchanged; Story 1.2 already builds the adapter as a complete unit of work. No story adds/removes/resequencing. Spike harnesses (Stories 1.3, 3.4) are explicitly non-library scratch code — unaffected by the no-stub rule, which scopes to shipped `src/`.
- **Artifact conflicts:** PRD — none (dev process is not a product requirement). Architecture — none (AD-8 port already is the spec; the rule generalizes it). UX — N/A.
- **Technical impact:** Process-only; no code exists yet.

## 3. Recommended Approach

**Direct Adjustment** (effort: Low, risk: Low). Encode the rules once in `CLAUDE.md` — loaded into every session, so all agents (create-story, dev-story, code-review) inherit them regardless of which planning artifact they read. An earlier draft targeted epics.md (AR14/AR15) + architecture spine conventions; Jack redirected to CLAUDE.md as the single enforcement point.

## 4. Detailed Change Proposals (applied)

### CLAUDE.md (applied)

Appended `## Development rules`:

- TDD mandatory for all implementation: red-green-refactor; a failing test precedes every piece of `src/` behavior. Scaffold/config files (package.json, tsconfig, CI yaml) exempt.
- Mock boundaries only (network, filesystem, clock, provider APIs); prefer real collaborators everywhere else.
- When a consumer/dependency does not yet exist, bind to its spec (port interface + contract tests) — never ship stub implementations in `src/`.

### Previously applied, recorded here (no further action)

- Story 1.1 (`1-1-install-and-configure-crucible.md`): Task 3 reworked to port-spec + registry with test-double fakes (no shipped stub); TDD section added to Dev Notes.
- Readiness report minor item 1: wording updated to spec-first resolution.
- Auto-memory: `tdd-spec-first-no-stubs.md` saved and updated with mocking rule.

## 5. Implementation Handoff

- **Scope:** Minor — applied directly in this session; nothing to route.
- **Sprint status:** No changes (no epic/story structure change); `1-1` remains ready-for-dev.
- **Success criteria:** Future create-story/dev-story runs mandate TDD, use boundary-only mocking, and resolve absent-consumer seams via specs — verifiable in Story 1.2's story file and Story 1.1's implementation.
- **Next step:** `dev-story` on Story 1.1.
