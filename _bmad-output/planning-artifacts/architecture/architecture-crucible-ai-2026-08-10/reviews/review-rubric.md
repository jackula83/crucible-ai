---
title: 'Rubric Review — ARCHITECTURE-SPINE.md (crucible-ai)'
type: review
reviewed: _bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md
checklist: good-spine (8 items)
date: 2026-08-10
verdict: PASS WITH CONDITIONS
---

# Rubric Review — Architecture Spine (crucible-ai)

**Gate verdict: PASS WITH CONDITIONS** — the spine is structurally sound and covers all FRs, but three high findings (undecided API defaults, incomplete run-outcome taxonomy, EOL Node 20 pin) are genuine story-divergence risks and should be fixed before epic breakdown. No critical findings.

## Checklist results

| # | Checklist item | Result |
| --- | --- | --- |
| 1 | Fixes real divergence points, misses none | **Partial** — 12 ADs hit the right seams; two misses (H-1, H-2) |
| 2 | Every Rule enforceable and divergence-preventing | **Mostly** — AD-12's "untested publishes" claim only partially enforced (M-2) |
| 3 | Deferred cannot cause divergence | **Pass** — every deferred item either names a default (excerpt cap ~500) or has its seam pre-reserved (Vitest subpath, AD-8 port shape) |
| 4 | Named tech verified-current | **Partial** — Node 20 stale (H-3), TS 7.0 date wrong (M-4); Jest 30 / tsup 8.x / OpenRouter plausible-current |
| 5 | FR-1..FR-9 all mapped | **Pass** — Capability map covers all nine; frontmatter `binds` matches. Caveat: FR-1's smoke-mode consequence is mapped but not bound by any Rule (H-1) |
| 6 | Every owned dimension decided/deferred/open | **Mostly** — operational envelope is explicitly owned (AD-12: CI, release, e2e split, spend/secrets; appropriate envelope for an npm library — no deploy/infra beyond GH Actions + npm exists at this altitude). Silent dimensions: docs deliverable (M-3), framework timeout envelope (M-1) |
| 7 | Diagrams valid mermaid with real shape | **Pass** — `graph LR` (incl. `-.implements.->` labeled dotted edge) and `sequenceDiagram` both parse; both encode load-bearing structure (dependency direction; run lifecycle with retry and three-zone aggregation), not decoration |
| 8 | Seed minimal | **Mostly** — one over-specification (L-1) |

## Findings

### Critical

None.

### High

- **H-1 — Defaults for omitted `runs`/`threshold` are undecided.** PRD FR-1 makes `runs` and `threshold` both optional and fixes only `runs` omitted → 1 (smoke mode). The spine never states either default: AD-3 says "executes the body `runs` times", the Data & formats convention row gives threshold's range but no default, and no AD binds the smoke-mode consequence. Two stories (binding vs aggregate) can diverge — e.g. omitted threshold as 1.0 vs error vs "any pass"; omitted runs as error vs 1. Fix: add defaults to AD-3 or the conventions table (`runs` default 1; decide `threshold` default explicitly).
- **H-2 — Run-outcome taxonomy doesn't classify user-code exceptions.** AD-4's three zones consume `passed | failed | errored`, and AD-8 classifies *provider* failures — but nothing says what a run is when the SUT/user's test body throws (engine bug, non-crucible error). One implementer will count it semantic-failed (it's the SUT misbehaving), another errored (it's not a judge verdict). This is exactly the divergence FR-7's "infra ≠ semantic" rule exists to prevent, one layer up. Fix: one sentence in AD-4 or AD-8 classifying non-crucible run-body throws.
- **H-3 — Node 20 is EOL; engines `>=20` + CI matrix 20/22/24 pins a dead runtime.** Node 20 reached end of life 2026-04-30 ([nodejs EOL trackers](https://eolradar.com/node-js-20-end-of-life-2026/), [HeroDevs](https://www.herodevs.com/blog-posts/node-js-v20-is-reaching-end-of-life)); the Node project recommends 24. For a greenfield library shipping late 2026, supporting an unpatched line is a stale pin. Fix: engines `>=22`, CI matrix 22/24 (keep 20 only with an explicit written rationale).

### Medium

- **M-1 — Framework timeout envelope unaddressed.** `crucible.it` registers one Jest test that awaits N parallel judge round-trips with up-to-3-attempt exponential backoff; Jest's default 5s per-test timeout will kill it. Whether crucible.it sets/derives a timeout, exposes one, or documents `jest.setTimeout` is a divergence point between the binding story and the docs story. Decide or defer explicitly.
- **M-2 — AD-12's "prevents untested publishes" is only partially enforced.** The tag-triggered publish gate runs unit tests only; the provider-touching e2e suite is a pre-tag *convention* ("make e2e before tagging") with no enforcement. Acceptable trade-off (no secrets in CI is the stronger invariant), but the Prevents line overclaims — restate as "unit-untested publishes", or add a required manual attestation step to the tag flow.
- **M-3 — Docs deliverable is a silent dimension.** PRD MVP scope explicitly includes getting started, OpenRouter config reference, and instruction-schema explainer (plus FR-1's mandated headroom guidance note). The spine has no AD, convention, seed entry, or deferred line for where docs live or what governs them — a whole in-scope deliverable with no home invites an orphan epic.
- **M-4 — Stack table: TS release date wrong; test toolchain undeclared.** TypeScript 7.0 GA'd 2026-07-08, not 2026-08-05 ([InfoQ](https://www.infoq.com/news/2026/08/typescript-7-released/), [techtimes](https://www.techtimes.com/articles/320049/20260710/typescript-7-now-stable-10-faster-builds-not-vue-svelte-yet.htm)); staying on 6.x while tooling settles remains a defensible call — fix the date. Also: the Deferred section name-drops ts-jest, but the Stack table names no TS-under-Jest transform (ts-jest vs @swc/jest vs babel) — a per-story tooling divergence for a repo that tests itself with Jest 30.

### Low

- **L-1 — Seed over-specifies core's internal file split.** Six named files inside `core/` (runner/aggregate/state/judge/report/config) prescribe granularity the code should own; the real invariants are the module boundaries and AD-2's arrows. Fine as illustration — mark it non-normative or drop to `core/` + responsibilities.
- **L-2 — tsup 8.x plausible-current but its ecosystem is migrating (tsdown as successor lineage).** Not stale today; verify at build-story time rather than treating the pin as settled.
- **L-3 — Failure-text channel ambiguity.** AD-3 says the aggregate verdict reaches Jest "as a single thrown failure"; AD-10 says *all* user-facing output goes through `core/report` to stdout. Which channel carries the failure narrative (thrown Error message vs reporter stdout print, or both) is unpinned — cosmetic divergence risk between reporter and runner stories.

## Checklist item 3 detail (Deferred audit)

Each deferred item checked for divergence capability: Vitest (seam + subpath reserved — safe), serial/concurrency caps (AD-8 retry named as the MVP absorber — safe), provider #2 (port shape fixed by AD-8 — safe), schema extraction (AD-11 keeps files registry-ready — safe), typed state / verdict caching (PRD non-goals — safe), excerpt cap (default ~500 named, reporter-owned — safe), TS 7 (pin stated — safe). No finding.

## Sources

- [InfoQ — Microsoft Releases TypeScript 7.0](https://www.infoq.com/news/2026/08/typescript-7-released/)
- [TechTimes — TypeScript 7 Now Stable](https://www.techtimes.com/articles/320049/20260710/typescript-7-now-stable-10-faster-builds-not-vue-svelte-yet.htm)
- [eolradar — Node.js 20 End of life: April 30, 2026](https://eolradar.com/node-js-20-end-of-life-2026/)
- [HeroDevs — Node.js v20 Is Reaching End of Life](https://www.herodevs.com/blog-posts/node-js-v20-is-reaching-end-of-life)
