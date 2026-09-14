---
title: 'Story 1.3 — Design the coherent instruction schema (spike)'
type: 'chore'
created: '2026-09-14'
status: 'done'
baseline_revision: '3d290aa'
final_revision: '941b25f'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/CLAUDE.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** The language-agnostic core of Crucible — the `coherent` instruction schema — existed only as a concept. Nothing proved a judge model can follow it reliably before Story 1.4 binds library code to it.

**Approach:** Author `schemas/coherent.md`, validate it against real judge models via a throwaway scratch harness (raw HTTP, zero library code), and record model behaviour as input to judge-model guidance.

## Boundaries & Constraints

**Always:** Schema is language-agnostic — no TypeScript or provider-specific instructions; payload assembly order documented in the schema itself; frontmatter carries name + output contract (registry-ready per AD-11). Harness is explicitly non-library scratch code (spike exemption from TDD/no-stub rules).

**Never:** No library/TS code in this story; no schema logic in code.

</intent-contract>

## Spike Exit (Acceptance) — all met

- Fixture matrix passes on ≥2 candidate judge models: **3 models, 20/20 verdicts each** (coherent → true, Jane/Bob incoherent → false, knowledge-boundary leak → false, stateless → judged on response alone).
- Strict JSON `{verdict, reasoning}` compliance measured across repeated calls: **60/60 across 5 reps per case**, zero code fences or extra prose.
- `schemas/coherent.md` carries frontmatter (`name: coherent`, output contract) — registry-ready.
- Schema contains no TypeScript- or provider-specific instructions; payload assembly documented in the schema.
- Model behaviour notes + ratings recorded: `docs/judge-models.md` (speed/cost/reliability per model, reliability graded against Fable 5's own interpretation; recommendation feeds OQ-6).

## Deliverables

- `schemas/coherent.md` — the instruction schema (the artifact Story 1.4 binds to)
- `e2e/ext/fixtures/coherent-conformance.json` — checked-in conformance matrix (feeds Story 3.4's language-agnostic conformance spike)
- `docs/judge-models.md` — model notes, ratings, recommendation, wire findings
- Harness: throwaway scratchpad script, not committed (per story design; Story 3.4 builds the repeatable version)

## Findings

- All three candidates (deepseek-v4-flash-0731, gemini-3.8-flash, claude-sonnet-5) were verdict-perfect on this matrix; reasoning quality differed (sonnet weaves STATE into justification).
- Recommended default judge: `deepseek/deepseek-v4-flash-0731` (~65× cheaper than sonnet, same accuracy here). Update the config example default from the outdated `deepseek-v3`.
- Story 1.2 wire assumptions confirmed live: envelope shape, strict-JSON adherence, per-call `usage.cost` availability.
- Local-dev TLS: corporate proxy requires Node `--use-system-ca` — bake into the Story 3.3 Makefile.
- Matrix is deliberately easy; ambiguous/adversarial fixtures are the follow-up before GA model guidance (noted in docs and deferred work).

## Review Triage Log

### 2026-09-14 — Spike (deliverables-over-ACs; no adversarial review pass per spike nature)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 1: (medium 1)
- reject: 0
- addressed_findings:
  - none
