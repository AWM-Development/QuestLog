# G-005 — Agent-interaction strategy for MCP-hooked sessions

Gate type: 🧠 strategy

Milestone ref: M-REMOTE.8 (`Docs/milestones/MILESTONES_V1_1_MCP.md`)

Opened: 2026-07-26 — filed by agent during T-031's (`ingest_text`) morning
review, raised by Alex

Context files (load ONLY these):
  - packages/mcp/src/tools/ingest-text.ts, packages/mcp/src/tools/get-source-status.ts (T-031 — today's only ingestion path: plain text/markdown, no attachment, no polling behavior defined)
  - packages/mcp/src/tools/list-campaigns.ts (today's only campaign-facing MCP tool — read-only, no create path)
  - apps/web/src/features/campaigns/components/modals/CampaignCreateModal.tsx (the only existing campaign-creation UX, web-app-only today — the fields/flow a `create_campaign` tool would need to mirror or simplify)
  - Docs/tickets/queue/T-033-mcp-onboarding-surface.md (queued, ungated — the `instructions`/`help` tool this gate's resolution either extends or leaves alone)
  - .claude/rules/mcp.md (write-tool conventions any new tool this gate spawns must follow)
  - Docs/milestones/MILESTONES_V2.md §11.1 "System prompt design & documentation" (formerly `MILESTONES_PT2.md §11`, retired — the old in-house-chat "system prompt design" — v2-deferred, NOT what this gate is about; read only to confirm the distinction, not to pull scope from it)

Open question: How should a DM actually work with QuestLog end-to-end
  through an MCP-connected Claude session, covering four coupled
  decisions:
  1. Can a DM attach a document (PDF, DOCX, image) rather than only
     pasting text into `ingest_text`, and if so, by what mechanism —
     base64 content embedded in the tool call input, MCP's separate
     "resources" primitive, or something else — given neither Claude
     Desktop nor claude.ai currently exposes a file-attachment-to-tool-call
     path today?
  2. How does a DM create a *new* campaign from inside a chat — a
     dedicated `create_campaign` tool, or should `ingest_text`/other
     tools accept a campaign name and create one implicitly on first
     use — given today the only creation path is the web app's
     `CampaignCreateModal`?
  3. Should the agent be instructed (via tool description or server
     `instructions`) to proactively re-call `get_source_status` after an
     `ingest_text` call and narrate progress to the user, or is that left
     entirely to model judgment with no guidance?
  4. What's the broader instructions/system-prompt strategy tying the
     above together — is `T-033`'s planned `instructions` field/`help`
     tool sufficient, or does this need something more (e.g. per-tool
     description changes, a stated interaction philosophy Alex wants
     applied consistently as more write tools ship)?

Blocks: M-REMOTE.8

Notes: Distinct from two things it could be confused with:
  - **Milestone 2's OCR gate** (`Docs/milestones/MILESTONES_V1_MCP.md` §2.4, "Scanned
    document support") — that's about extracting text from
    already-uploaded scanned images/PDFs inside the existing web-upload
    pipeline. Question 1 above is upstream of that: whether a file can
    reach an MCP tool call at all, a transport/protocol question, not an
    extraction-quality one.
  - **`MILESTONES_PT2.md` §11's "system prompt design"** — that was
    scoped for the old in-house chat LLM service (`packages/core`'s
    `llm.service.ts` / `buildSystemPrompt`), a surface now v2-deferred
    post-MCP-pivot (`Docs/milestones/MILESTONES_V1_MCP.md`'s Milestone 3: "Chat UI ✅
    shipped, now v2 surface"), and covered by CLAUDE.md's "never pull
    work from MILESTONES_PT1.md/PT2.md" rule. Question 4 here is about
    how **Claude itself** behaves once connected via MCP — a v1-shaped,
    M-REMOTE-family concern, not the deferred feature. Do not resolve
    this gate by pulling PT2 §11's scope forward; it answers a different
    question for a different surface.

  Bundled into one gate (Alex's explicit choice over four separate gates)
  because all four are facets of the same underlying decision — how a DM
  experiences QuestLog through Claude — and are expected to resolve
  together in one `/ungate` session, even though they may spawn multiple
  follow-on tickets (e.g. a `create_campaign` ticket, an
  attachment-ingestion ticket, an amendment to T-033's `instructions`
  content) rather than a single ticket.

  No options evaluated in depth yet for any of the four sub-questions —
  this gate exists to bring them to Alex, not to pre-load a recommended
  default.
