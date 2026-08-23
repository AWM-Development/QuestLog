# G-050 — MCP sampling migration: shift LLM-call cost from backend to the connected client's session

Gate type: 🧠 strategy

Milestone ref: none — this is a cross-cutting architecture question about
  every existing and future LLM-integration call site, not an unticketed
  task belonging to one milestone (same framing G-013 used for a
  cross-cutting process question). Any resulting decision would touch
  `M-EXTRACT` (entity extraction), `M-CONTINUITY` (contradiction
  detection, `T-163`/`T-164`), and every future milestone task that adds a
  new LLM call, not just one of them.

Opened: 2026-08-23 — by Alex, during `/morning-review` of `T-163`'s PR
  (#305), after asking whether the app's LLM-integration pattern should
  lean on the token usage of the LLM the user is already chatting through
  in-session (MCP's `sampling` capability) rather than the app's own
  backend-billed Anthropic API key.

Context files (load ONLY these):
  - packages/core/src/services/llm.service.ts (`createLlmService`,
    `callClaude`, `callClaudeStructured` — the one reusable LLM-integration
    pattern every current call site uses, all backend-billed via its own
    `new Anthropic()` client)
  - packages/core/src/services/continuity.service.ts,
    packages/core/src/services/entity.service.ts (`detectCandidates`) —
    the two structured-extraction consumers of `callClaudeStructured`
    (`T-163`, `T-119`/`G-021`)
  - packages/core/src/services/conversation.service.ts — the
    free-form-chat consumer of `callClaude`, the highest-volume call site
    and the one most likely to be cost-sensitive at scale
  - Docs/tickets/gated/resolved/G-021-entity-extraction-algorithm-quality.md
    (Resolution § 1 — the existing precedent that explicitly chose
    backend-billed LLM calls over the (unconsidered at the time) MCP
    client alternative, reasoning from the app's own per-call cost being
    "nowhere near chat/search-path volume")
  - .claude/rules/mcp.md (current MCP tool/server conventions — none of
    which mention `sampling`; any migration changes this file)
  - packages/mcp/package.json, apps/mcp-stdio/package.json
    (`@modelcontextprotocol/sdk": "^1.29.0"` — confirms the installed SDK
    version actually supports the `sampling` capability's
    `server.createMessage()` / `ClientCapabilities.sampling` surface,
    before assuming this is even a same-version toggle)

Open question: Should QuestLog's LLM-integration pattern migrate from
  backend-billed Anthropic API calls (`llm.service.ts`'s own client,
  paid by the app) to MCP's `sampling` capability (the server requests a
  completion from whatever LLM the connected client/host is already
  running, billed to the user's own session) — for which call sites, and
  on what rollout sequence? Concretely:
  - Does `sampling` cover every current call shape, including
    `callClaudeStructured`'s forced-tool-schema structured output (used by
    `detectCandidates` and `continuity.service.ts`), or only free-form
    completions like `callClaude`'s chat path — i.e., is this a full
    replacement or a partial one that leaves structured extraction on the
    backend-billed path regardless?
  - Not every MCP client implements `sampling` (it's an optional client
    capability) and QuestLog currently ships two transports
    (`apps/mcp-stdio`, plus the M-REMOTE.3 HTTP transport) reachable by
    clients with uneven support — does the app need a capability-detection
    fallback to the current backend-billed path per client, or is a
    baseline capability requirement acceptable?
  - `ingest_text`'s entity/contradiction extraction runs as async
    background work the caller polls (`get_source_status`), not a live
    request the connected client is necessarily still attached to when it
    completes — does `sampling` (a synchronous request/response against
    the currently-connected client) actually fit that async shape, or
    does it only fit the synchronous `query_lore`/chat-style paths?
  - Given `G-021`'s existing rationale rests on backend cost being small
    ("fractions of a cent per document"), is the motivation for migrating
    primarily cost, or something else (e.g. giving the user visibility
    into/control over which model answers their queries, avoiding a
    second LLM-provider dependency the app itself must manage)? The
    answer changes which call sites are worth migrating first.
  - If pursued, this is a multi-step refactor, not a single ticket — what
    is the actual sequence (e.g. foundational sampling-integration ticket
    mirroring `T-118`'s role for `llm.service.ts` itself, then one
    migration ticket per call site) and does `llm.service.ts` keep both
    paths behind one interface (injectable per-call, per-client
    fallback), or fork into two services?

Blocks: none yet — no ticket currently depends on this gate resolving;
  filed to capture the question before it's lost, not because anything
  is stalled on it. If resolved to pursue, this will draft a foundational
  ticket plus a migration ticket per existing call site
  (`conversation.service.ts`, `entity.service.ts`'s `detectCandidates`,
  `continuity.service.ts`), and set precedent for any future ticket that
  wants to add a new LLM call.

Notes: Raised directly out of `T-163`'s `/morning-review` — no prior
  design exploration exists yet. `G-021` (2026-08-03) is the closest prior
  art but decided the opposite question under a different (and, at the
  time, apparently unconsidered) alternative: it compared "keep the
  heuristic" vs. "call an LLM from the backend," not "call an LLM from the
  backend" vs. "use the connected client's own LLM via `sampling`." This
  gate doesn't presuppose `G-021` was wrong — cost was genuinely
  negligible per-call — it asks whether cost was ever the only reason to
  care, and whether `sampling`'s per-transport/async-fit constraints
  (see Open question) make this a clean swap or a partial one.
