# G-046 — `ingest_text` idempotency-key strategy

Gate type: 🧠 strategy

Milestone ref: M-BUG.6 (`Docs/milestones/MILESTONES_BUGS.md`)

Opened: 2026-08-19 — by Alex/agent during planning, while ticketing follow-ups to T-159 (`ingest_text` silently succeeding while returning an error to the caller)

Context files (load ONLY these):
  - Docs/tickets/queue/T-159-ingest-text-error-response-after-partial-success.md (the bug this gate is prophylaxis for: a client that retries `ingest_text` on an error it can't distinguish from "nothing was written" currently creates a duplicate source with identical content)
  - packages/mcp/src/tools/ingest-text.ts (whole file — the two entry shapes a key scheme has to cover: a fresh `ingest_text` call, and the chained `sourceId`-based append path used for splitting a long document across multiple calls, T-065)
  - packages/shared/src/validators/mcp.ts (`IngestTextInput`) — current input shape, to see what a key would be derived from or added alongside

Open question: Should `ingest_text` gain a request-level idempotency mechanism, and if so which shape — a client-supplied idempotency key (and if so, how long is a key valid, and is it scoped per-campaign or global), or a content-hash-derived dedup key computed server-side from `campaignId` + `content` + `title`? Either way, how should it interact with the existing chained `sourceId`-based multi-call ingestion path (T-065), where the "same" logical document is deliberately split across several distinct `ingest_text` calls with different `content` per call?

Blocks: M-BUG.6 (`Docs/milestones/MILESTONES_BUGS.md`) — no ticket has been drafted; `Scope` can't honestly be written until this question resolves. The milestone task carries `(Gated on: G-046)` in place of a ticket id.

Notes: Raised alongside G-045 (`delete_source` tool design) as a follow-up to T-159's bug report, which suggested both as hardening against the same duplicate-source failure mode T-159 itself already fixes at the source (no more false-error responses after a real write). This gate is about defense in depth for the remaining case — a genuinely dropped response (network failure between server and client, not a bug in the server) — not a replacement for T-159's fix. No options have been pre-explored yet; this is a cold-open gate for `/ungate` to work through with Alex from scratch.
