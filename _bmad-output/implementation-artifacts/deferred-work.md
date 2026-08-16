# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-install-and-configure-crucible.md`
  summary: Document (Story 3.6 gotchas) that API keys must never be placed inside config `meta` — `meta` is an opaque passthrough per FR-7 and is deliberately not scanned for key-like fields, so a key committed there bypasses the NFR1 config guard.
  evidence: Review confirmed `meta` contents are never validated (by design, FR-7 opacity); the top-level key-like rejection cannot cover it, making this a real committable-secret hazard only docs can mitigate.
