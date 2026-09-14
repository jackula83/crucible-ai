# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-install-and-configure-crucible.md`
  summary: Document (Story 3.6 gotchas) that API keys must never be placed inside config `meta` — `meta` is an opaque passthrough per FR-7 and is deliberately not scanned for key-like fields, so a key committed there bypasses the NFR1 config guard.
  evidence: Review confirmed `meta` contents are never validated (by design, FR-7 opacity); the top-level key-like rejection cannot cover it, making this a real committable-secret hazard only docs can mitigate.

- source_spec: `_bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/prd.md` (§4.3 assertion-selection doctrine, decided 2026-09-14)
  summary: Story 3.6 getting-started docs must teach the assertion-selection ladder — plain framework assertions first, `exact()`/`range()` for embedded values (post-MVP), `coherent()` only for inherently semantic claims (prose, reasoning, state consistency, knowledge boundaries).
  evidence: Doctrine decided with Jack 2026-09-14 and recorded in the PRD; without a docs entry it will be missed when Story 3.6 is drafted from the epic ACs alone.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-reliable-judge-connectivity-via-openrouter.md`
  summary: No per-attempt timeout exists anywhere — a hung provider socket stalls a judge call forever and the retry machinery never engages; decide per-attempt timeout policy when Story 1.4's runner derives test timeouts from run count and provider budget (AD-3).
  evidence: Both reviewers flagged it; the spec matrix lists "timeout" as retryable input but only the caller's signal can currently produce one, and nothing arms such a signal yet.
