# Review: PRD ↔ Spine Reconciliation

- **Reviewed:** `ARCHITECTURE-SPINE.md` (draft, 2026-08-10) against `prd.md` (final, 2026-08-10)
- **Scope:** report only what the PRD requires of architecture that did NOT land in the spine (covered or deliberately deferred). Known divergence excluded per brief: AD-12 supersedes PRD §6.1 CI e2e (now local-only, user-directed).
- **Verdict:** GAPS FOUND

## Method

Walked every FR and its testable consequences, feature-specific NFRs, glossary contracts, §5 non-goals, §6 MVP scope, and the five open questions the PRD assigns to architecture (OQ-1, 3, 5, 6, 7). Checked each against the spine's ADs, Consistency Conventions, Stack, Structural Seed, Capability Map, and Deferred list.

## What landed cleanly (not findings — recorded for audit trail)

- FR-1 pass rule (integer-safe ⌈threshold × runs⌉, run passes iff every assertion passes) → AD-3/AD-4.
- FR-2 parallel-by-default, rate-limit assumption → AD-3, AD-8 retry; serial/concurrency caps deferred.
- FR-3/FR-4 state contract and isolation → AD-5; **OQ-7 resolved** (AsyncLocalStorage ambient scope, cross-language contract named).
- FR-5 native boolean assertion, no custom matchers → AD-6; stateless mode falls out of AD-7's payload shape.
- FR-6 schema-driven judging → AD-1/AD-11; **OQ-5 resolved** (schemas ship in package, versioned by package version, registry-ready frontmatter).
- FR-7 fail-fast on bad provider, meta passthrough, errored ≠ failed → AD-4/AD-8/AD-9; **OQ-3 resolved** (retry taxonomy: retryable vs fatal, 3 attempts, backoff+jitter).
- FR-8/FR-9 diagnostics, verbosity ladder, `CRUCIBLE_VERBOSE` env override wins, stdout-only, errored visually distinct → AD-10; excerpt cap explicitly deferred.
- Secrets: keys via env only, config committable → AD-9 (`OPENROUTER_API_KEY`) — resolves the naming half of OQ-1.
- Glossary contracts (threshold as decimal [0,1], run status trichotomy, verdict shape, config file shape) → Conventions table.
- §5 non-goals and §6.2 out-of-scope items all appear in Deferred or are structurally excluded.

## Findings (did NOT land)

### G-1 — OQ-6 (judge model guidance) is unaddressed — neither resolved nor deferred

PRD §8 OQ-6 asks for "recommended/default judge models and a documented stance on judge reliability per model tier." The spine's AD-9 makes `model` a required, validated config field but names no default, no recommendation, and no reliability stance; OQ-6 appears nowhere — not in an AD, not in Deferred. Every other architecture-assigned OQ (1, 3, 5, 7) is explicitly dispatched. This is the only assigned open question the spine silently drops. Even "deferred to docs, config has no default model" would be a legitimate landing; silence is not.

### G-2 — MVP docs deliverables (§6.1) have no home in the spine

PRD §6.1 puts three docs in MVP scope: getting started, config reference (OpenRouter page), instruction-schema explainer. Two PRD notes make docs load-bearing, not decorative:
- FR-1 note: "Getting-started docs **must** include runs/threshold headroom guidance" (binomial-noise trap).
- §4.3: forgetting `expect()` on a verdict is "documented as a gotcha."

The Structural Seed has no `docs/` (or README stance), no AD or Deferred entry mentions documentation, and AD-12's release envelope ships code only. The spine may reasonably rule docs out of architectural scope — but it must say so; currently the requirement is dropped.

### G-3 — Smoke mode (FR-1: `runs` omitted → exactly one run) never restated

PRD FR-1 consequence: "Omitting `runs` executes the body exactly once (smoke mode); the test passes iff that run passes" — this is the entire mechanism behind UJ-2. AD-3 says the body executes "`runs` times" and AD-4's formula assumes `runs` and `threshold` exist; neither the ADs nor the Conventions table fix the defaults when the options are omitted (`runs` default 1; `threshold` behaviour in smoke mode). A shell implementer working from the spine alone cannot derive smoke mode.

### G-4 — OQ-1 residue: CI-secret documentation, and the publish workflow's own secret

OQ-1's remaining half is "CI-secret documentation." AD-12 dissolves most of it (CI runs zero provider traffic, no API key) — but AD-12's own tag-triggered `npm publish` requires an npm token/provenance credential in GitHub Actions, which is a CI secret the spine neither names nor governs (AD-9's rule covers provider keys only). Local e2e key setup docs (where `OPENROUTER_API_KEY` comes from for `make e2e` / the pre-commit hook) are likewise unplaced. Small, but OQ-1 was assigned and is only ~half landed.

### G-5 — FR-8's default-output content contract is thinner in AD-10 than in the PRD

FR-8 requires default failure output to name, per failing run: **the failing assertion's claim, a response excerpt, and the judge's reasoning**. AD-10 compresses this to "pass rate vs threshold + first judge error per failing run" and the verdict convention carries only `{ verdict, reasoning }` — the claim and the response excerpt are not guaranteed by any spine rule to reach the reporter. Likely intended, but as written an implementer could ship reasoning-only failure output and satisfy every AD while violating FR-8's testable consequence.

## Notes (observed, not findings)

- PRD glossary calls the judge an "AI agent"; AD-7 narrows it to a single stateless completion. Read as a legitimate architectural refinement (the schema-following contract is preserved), not a contradiction — but worth one line in the spine if contributors will hold the glossary against it.
- PRD is silent on the default `threshold` when omitted with `runs` present; that gap originates in the PRD, not the spine (noted under G-3 only where smoke mode is concerned).
