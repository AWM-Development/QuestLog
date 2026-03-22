# QuestLog — Product Requirements Document

**Location:** `Docs/PRD.md`

**Version:** 0.1.0-draft
**Author:** Alex Meyer
**Last Updated:** 2026-03-09
**Status:** Living Document — Early Draft

**Related Docs:**
- `Docs/README.md` — Overview of all project documentation
- `Docs/DEVELOPMENT_GUIDE.md` — Coding conventions and patterns
- `Docs/MILESTONES.md` — Task breakdown with branch names
- `Docs/DESIGN_SYSTEM.md` — Visual design specification (colors, components, entity system)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Persona & Context](#2-user-persona--context)
3. [Core User Flows](#3-core-user-flows)
4. [Feature Specifications](#4-feature-specifications)
   - 4.1 Campaign Creation & Document Import
   - 4.2 Agent Conversation
   - 4.3 Session Logging & Entity Linking
   - 4.4 Session Prep Briefs
   - 4.5 Entity Graph & Relationship Map
   - 4.6 Secret Management
   - 4.7 Player-Facing Recaps
   - 4.8 At-the-Table Reference Features
   - 4.9 Tonal & Writing Style Customization
5. [Design System & UX Concepts](#5-design-system--ux-concepts)
6. [High-Level Architecture](#6-high-level-architecture)
7. [Non-Goals & Explicit Exclusions](#7-non-goals--explicit-exclusions)
8. [Risks & Open Questions](#8-risks--open-questions)
9. [Milestone Plan](#9-milestone-plan)

---

## 1. Product Overview

### What QuestLog Is

QuestLog is a single-user, AI-powered campaign management tool for tabletop RPG dungeon masters who run in-person games. It ingests your campaign material — session notes, worldbuilding docs, published module PDFs, markdown files — and gives you back an intelligent agent that *knows your world*. You can ask it questions, generate content consistent with your existing lore, get pre-session prep briefs, and manage the growing web of NPCs, locations, factions, and plot threads without drowning in wiki busywork.

### What QuestLog Is Not

QuestLog is **not a virtual tabletop**. It does not replace Roll20, Foundry, or Fantasy Grounds. There is no shared player view, no token movement, no fog of war, no real-time multiplayer game board. It is the DM's **personal command center** — a smart DM screen open on your laptop or tablet during an in-person session while your players sit around you with character sheets and a physical map.

### Why It Exists

Existing tools force a choice between *flexible but dumb* (Notion templates, Google Docs) and *structured but tedious* (World Anvil, Kanka). DMs who use LLMs for campaign prep currently copy-paste context into ChatGPT conversations that forget everything between sessions. QuestLog closes both gaps: it provides persistent, structured knowledge that's accessible through natural conversation rather than wiki navigation.

### Success Criteria

QuestLog v1 ships when it can support a single campaign through a full arc (roughly 8–12 sessions) with demonstrably less prep friction than the current workflow of Notion + ChatGPT. Specifically:

- A new campaign with 20+ pages of imported material is queryable within 5 minutes of first import.
- The agent accurately recalls entities, relationships, and plot details from session logs written 4+ sessions ago.
- Session prep briefs surface at least 80% of active threads without manual curation.
- The tool is usable at the table on a tablet without workflow interruption during a 3-hour session.

---

## 2. User Persona & Context

### Primary Persona: The Prep-Heavy DM

**Name:** Alex (self — eating your own dogfood)
**Experience:** Runs 1 campaign with 7 players, weekly cadence. 3+ years of DMing. Comfortable with technology, uses LLMs for creative ideation, maintains campaign notes in markdown.

**Pain points:**
- Context scattered across Google Docs, markdown files, PDF modules, and old ChatGPT threads.
- Spends 15–20 minutes before each session just reconstructing "where were we?"
- NPCs and plot threads fall through the cracks after ~10 sessions as the world gets complex.
- Copy-pasting context into LLM conversations is tedious and lossy.
- Existing campaign managers (World Anvil, Kanka) feel like data entry, not creative tools.

**What success looks like for this user:**
- Imports existing material once, asks questions immediately.
- Writes session logs in natural prose, not structured forms; the system picks up entities organically.
- Opens the app before a session and gets a useful brief without manual curation.
- Mid-session, glances at the tablet for a name, a motivation, a room description — and gets it in under 5 seconds.
- The tool feels like a creative collaborator, not a database admin panel.

### Usage Contexts

| Context | Device | Duration | Priority |
|---|---|---|---|
| Session prep (1–2 days before) | Desktop/laptop | 30–90 min | High — deep interaction with agent, reviewing briefs, planning encounters |
| At the table (during session) | Tablet or laptop | 3–4 hours | Highest — fast lookups, note jotting, initiative tracking, glanceable info |
| Post-session logging | Desktop/laptop | 15–30 min | Medium — brain dump while memory is fresh |
| Between-session worldbuilding | Desktop/laptop | Variable | Medium — creative exploration, entity fleshing out, "what if" conversations |

---

## 3. Core User Flows

### Flow 1: First Campaign Setup & Import

```
[Create Campaign] → [Choose Theme] → [Name & Description]
        ↓
[Import Material]
  ├── Drag & drop files (PDF, MD, TXT)
  ├── Paste raw text
  └── Connect folder (future)
        ↓
[Processing indicator — mascot eating scrolls]
  ├── Text extraction
  ├── Chunking & embedding
  └── Entity pre-extraction (suggested, not committed)
        ↓
[Campaign Dashboard]
  ├── "Your campaign is ready" prompt
  ├── Suggested first questions
  └── Import summary (X pages, Y entities detected)
        ↓
[First Agent Conversation]
```

**Critical path:** The time from "upload a PDF" to "ask a question and get a contextually accurate answer" must be under 5 minutes for a 200-page module. This is the first-time experience that determines retention.

### Flow 2: Session Logging (During & After Session)

```
[Open Campaign] → [Session Notes sidebar always accessible]
        ↓
[Persistent notes panel — jot notes throughout the session]
  ├── Lightweight, always-open sidebar or collapsible panel
  ├── Inline entity detection (underline as you type)
  ├── Click to confirm/create entity
  ├── Auto-link to existing entities
  └── Notes accumulate over the course of the session
        ↓
[End of session → Save]
  ├── Optionally title the session (e.g., "Session 3")
  ├── Optionally add a summary note ("party in dungeon")
  ├── Save finalizes and processes the accumulated notes
        ↓
[Post-Save Processing]
  ├── Update entity pages with new context
  ├── Update relationship graph
  ├── Re-embed new content
  └── Mascot writing with quill
        ↓
[Session saved — view session timeline]
```

### Flow 3: Pre-Session Prep

```
[Open Campaign] → [Session Prep]
        ↓
[Auto-generated brief]
  ├── "Previously on..." narrative summary
  ├── Active plot threads (ranked by recency/urgency)
  ├── Likely NPCs (based on last session + active threads)
  ├── Unresolved flags & loose ends
  ├── Suggested follow-ups (agent-generated)
  └── Quick links to relevant entities
        ↓
[Edit / Pin / Dismiss items]
        ↓
[Jump to Agent Chat for deeper prep]
```

### Flow 4: Mid-Session Quick Reference

```
[Glance at tablet]
        ↓
[Quick action bar]
  ├── Search (fuzzy, instant) → Entity card or agent answer
  ├── Initiative tracker → Tap to manage combat
  ├── Map reference → Tap room for notes
  └── Agent chat → Ask anything mid-session
        ↓
[Result in <3 seconds]
        ↓
[Back to the table]
```

**UX constraint:** Every mid-session interaction must complete in under 5 seconds from intent to answer. No multi-step wizards, no loading screens, no modals that require dismissal.

---

## 4. Feature Specifications

### 4.1 Campaign Creation & Document Import

#### Overview
The entry point to QuestLog. A user creates a campaign, chooses a visual theme, and imports their existing material. The system processes imports into a searchable, queryable knowledge base.

#### Campaign Object
- **Name** (required): free text, 1–100 characters
- **Description** (optional): brief prose summary, up to 500 characters
- **Theme** (required): selected from preset list (fantasy, sci-fi, western, horror, modern); affects mascot, color palette, typography
- **System/Game** (optional, freeform): e.g., "D&D 5e", "Pathfinder 2e", "Blades in the Dark" — used for agent context
- **Status**: active / archived

#### Import Sources
| Source | Format | Processing |
|---|---|---|
| File upload | PDF, MD, TXT, DOCX | Text extraction → chunking → embedding |
| Paste | Raw text | Direct chunking → embedding |
| Bulk upload | Multiple files at once | Queued sequential processing |

#### Import Processing Pipeline (User-Facing Behavior)
1. **Upload acknowledged** — file appears in import queue with progress indicator.
2. **Text extraction** — PDFs are parsed (OCR if scanned), markdown/text passed through directly.
3. **Chunking** — content split into semantically meaningful chunks (section headers, paragraph boundaries).
4. **Embedding** — chunks converted to vector embeddings and stored.
5. **Entity suggestion** — system scans for named entities (people, places, organizations, items) and presents them as suggestions, not auto-committed entries.
6. **Completion** — source appears in campaign's source list, content is immediately queryable.

#### Import UX Concept

```
┌─────────────────────────────────────────────────┐
│  📂 Import Campaign Material                     │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │                                             │ │
│  │      Drop files here or click to browse     │ │
│  │                                             │ │
│  │      PDF · MD · TXT · DOCX                  │ │
│  │                                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ── or paste text directly ──────────────────── │
│  ┌─────────────────────────────────────────────┐ │
│  │ Paste your campaign notes here...           │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Recent Imports                                   │
│  ✅ curse-of-strahd-module.pdf     142 pages     │
│  ✅ session-notes-1-through-8.md   24 pages      │
│  🔄 world-building-notes.md       processing...  │
│     [████████░░░░] 67%  🐉 *nom nom*            │
│                                                   │
│  Suggested Entities (from imports)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Strahd   │ │ Barovia  │ │ Ireena   │ ...    │
│  │ NPC  [+] │ │ Loc  [+] │ │ NPC  [+] │        │
│  └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────┘
```

#### Edge Cases & Constraints
- **Maximum file size:** 50 MB per file (covers most published module PDFs).
- **Scanned PDFs:** OCR attempted; if quality is poor, user is warned and offered the option to paste text manually.
- **Duplicate detection:** If a file with the same name and hash is uploaded again, prompt user: "This looks like a file you've already imported. Replace, keep both, or skip?"
- **Incremental import:** Users can import additional material at any time; existing knowledge base is extended, not rebuilt.

#### Acceptance Criteria

1. A user can create a campaign by providing a name, description, and theme; the campaign is immediately visible in the campaign list.
2. A user can upload a PDF, MD, TXT, or DOCX file; the file appears in the import queue with a processing indicator.
3. A user can paste raw text directly; pasted text is accepted as a source and enters the same processing pipeline as file uploads.
4. After upload, extracted text is chunked and embedded; the source status transitions to "complete" and the content is queryable through the agent.
5. A 200-page PDF module is fully queryable within 5 minutes of upload on standard hardware.
6. Uploading a file with the same name and hash as an existing source prompts the user with Replace / Keep Both / Skip options; each option behaves as described.
7. Files exceeding 50 MB are rejected with a clear error message before upload begins.
8. A campaign can have additional material imported at any time; new content extends the existing knowledge base without requiring re-processing of prior imports.

---

### 4.2 Agent Conversation

#### Overview
The primary interface of QuestLog. A persistent chat with an AI agent that has full context on the user's campaign. This is not a generic chatbot — it's an agent specialized for DM workflows with access to the campaign's knowledge base.

#### Agent Capabilities

| Mode | Trigger Context | Behavior |
|---|---|---|
| **Creative collaborator** | Prep sessions, worldbuilding | Generates content consistent with established lore. Offers options, asks clarifying questions, proposes ideas. |
| **Fast recall** | Mid-session, quick reference | Terse, factual answers. Prioritizes speed and accuracy over elaboration. Cites source when relevant. |
| **Analytical planner** | Between sessions, arc planning | Synthesizes across sessions. Identifies patterns, loose threads, contradictions. Suggests narrative directions. |
| **Rules reference** | Mid-session, mechanics questions | Answers rules questions from both imported material and general TTRPG knowledge. |

#### Context Assembly
The agent constructs its context window from multiple sources for each query:

1. **Vector similarity search** — find chunks semantically related to the query.
2. **Entity graph traversal** — if the query mentions known entities, pull in their pages and immediate relationships.
3. **Recency weighting** — recent session logs are weighted higher for "current state" questions.
4. **Conversation history** — the current conversation thread provides conversational context.
5. **Campaign metadata** — system/game, active session count, last session date.

#### Conversation Persistence
- All conversations are saved and associated with the campaign.
- Conversations are themselves indexed and searchable.
- The agent can reference prior conversations: "You mentioned last week you wanted to introduce a rival faction."
- Users can title, archive, or delete conversations.
- Conversations can optionally be tagged (prep, worldbuilding, session-5, etc.).

#### Agent Chat UX Concept

```
┌──────────────────────────────────────────────────────────┐
│  🐉 QuestLog Agent          Curse of Strahd Campaign     │
│  ─────────────────────────────────────────────────────── │
│                                                           │
│  ┌─ You ─────────────────────────────────────────────┐   │
│  │ The party just decided to ally with the Keepers    │   │
│  │ of the Feather. What does Strahd know about this   │   │
│  │ group, and how would he react?                     │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─ QuestLog ────────────────────────────────────────┐   │
│  │ Based on the module and your session 6 notes,      │   │
│  │ Strahd is aware of the Keepers but considers them  │   │
│  │ a minor nuisance...                                │   │
│  │                                                     │   │
│  │ 📎 Sources: curse-of-strahd.pdf p.142,            │   │
│  │    session-6-log, entity:keepers-of-the-feather    │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ┌────────────────────────────────────────────┐  [Send]  │
│  │ What if the party tries to recruit the...  │          │
│  └────────────────────────────────────────────┘          │
│                                                           │
│  Sidebar: Related Entities                                │
│  ├── Strahd von Zarovich (NPC)                           │
│  ├── Keepers of the Feather (Faction)                    │
│  └── Winery (Location)                                   │
└──────────────────────────────────────────────────────────┘
```

#### Behavioral Guardrails
- The agent should **never fabricate entities that don't exist in the campaign** unless explicitly asked to create something new. If it doesn't know, it says so and offers to create.
- The agent should **cite its sources** — which document, session log, or entity page it drew from.
- The agent should **respect the secret/known boundary** (see §4.6) and flag when an answer involves DM-only information.
- When generating creative content, the agent should **offer 2–3 options** rather than a single output, unless the user's prompt is highly specific.

#### Acceptance Criteria

1. A user can send a message in the agent chat and receive a response that draws on content from the campaign's imported material or session logs.
2. The agent response includes at least one source citation (document name, session log, or entity page) for factual claims about the campaign.
3. When asked about a topic not present in the campaign knowledge base, the agent explicitly acknowledges the absence rather than fabricating an answer.
4. All conversations are persisted; closing and reopening the app shows the full conversation history.
5. A user can create a new conversation, switch between conversations, and the agent context is scoped to the active conversation.
6. Conversations can be titled and archived.
7. Agent responses stream to the UI (text appears progressively, not all at once after a delay).
8. If the agent references DM-only information, that content is visually flagged with the 🔒 indicator in the response.

---

### 4.3 Session Logging & Entity Linking

#### Overview
Session notes are captured in a persistent sidebar panel that's open throughout the session — not as a post-session brain dump. The DM jots notes as things happen: a quick line when the party enters a new room, a name when an NPC improvises something unexpected, a reminder about a ruling they made on the fly. The system detects entities in real time, links them to existing entries or suggests creating new ones, and updates the knowledge graph when the session is saved.

#### The Notes Panel
- **Always accessible:** a collapsible sidebar or panel that's available from any screen (agent chat, map, combat tracker). One tap to open, one tap to collapse. Never blocks the primary view.
- Rich text with markdown support (headers, bold, italic, lists, blockquotes).
- **Inline entity detection:** as the DM types, recognized entity names are underlined with a subtle highlight. Tap to confirm the link, dismiss it, or create a new entity if the name is unrecognized.
- **Entity creation inline:** selecting any text and pressing a hotkey (or right-click) opens a quick-create panel: name (pre-filled from selection), type (NPC/Location/Faction/Item/Arc), brief description. Minimal friction — the full entity page can be fleshed out later.
- **Detected entities list:** the bottom of the panel shows all detected/linked entities for the current session, grouped by type.
- **Auto-save draft:** notes are continuously saved locally so nothing is lost if the app crashes mid-session. The DM never has to worry about losing notes.

#### Finalizing a Session Log
At the end of a session (or whenever the DM is ready), they hit **Save Session**. This opens a lightweight finalization step:
- **Session title** (optional): e.g., "The Feast of St. Andral" or just "Session 9." Auto-generates a title from content if left blank.
- **Session number** (auto-incremented, editable).
- **Date** (defaults to today, editable).
- **Summary note** (optional): a one-liner capturing the overall arc, e.g., "party infiltrated the coffin shop, recovered the bones." This is for the DM's own quick reference in the session timeline — not a recap.
- **Tags** (freeform, for personal organization).

The DM can also continue editing after saving — a session log is never locked.

#### Session Log Object
- **Session number** (auto-incremented, editable)
- **Date** (defaults to today, editable)
- **Title** (optional, freeform)
- **Summary** (optional, freeform one-liner)
- **Content** (rich text with entity links — the accumulated session notes)
- **Tags** (freeform, for personal organization)
- **Linked entities** (auto-populated from inline links)

#### Post-Save Processing
When a session log is saved:
1. Content is chunked and embedded into the knowledge base.
2. Newly created entities get stub pages populated with the context from this log.
3. Existing entity pages are updated with the new session's context.
4. The relationship graph is updated: if two entities appear in proximity within the same passage, a relationship edge is suggested.
5. Session metadata (number, date) is used for recency weighting in future queries.

#### Session Notes Panel UX Concept (During Session — Sidebar Mode)

```
┌─────────────────────────────────────┬──── Session Notes ─────┐
│                                     │                        │
│     Main View                       │ 📝 Session 9 (draft)  │
│     (Agent Chat / Map /             │                        │
│      Combat Tracker /               │ Party arrived at       │
│      whatever the DM                │ [Vallaki] before dusk. │
│      is using right now)            │                        │
│                                     │ [Father Lucian] met    │
│                                     │ them at the gates —    │
│                                     │ bones stolen from      │
│                                     │ [St. Andral's Church]. │
│                                     │                        │
│                                     │ Avoided [Izek Strazni] │
│                                     │ in the square.         │
│                                     │                        │
│                                     │ Found [Henrik] hiding  │
│                                     │ in coffin shop. Vampire│
│                                     │ spawn in the basement. │
│                                     │                        │
│                                     │ ── Entities (6) ────── │
│                                     │ 👤 Father Lucian       │
│                                     │ 👤 Izek Strazni        │
│                                     │ 👤 Henrik (new)        │
│                                     │ 📍 Vallaki             │
│                                     │ 📍 St. Andral's        │
│                                     │ 📍 Coffin Shop         │
│                                     │                        │
│                                     │ [+ Add Entity]         │
│                                     │         [Save Session] │
└─────────────────────────────────────┴────────────────────────┘
```

#### Save Session Dialog

```
┌─────────────────────────────────────┐
│  Save Session                       │
│                                     │
│  Title: The Feast of St. Andral     │
│  Session #: 9                       │
│  Date: March 8, 2026               │
│  Summary: Party recovered the bones │
│           from the coffin shop      │
│  Tags: [vallaki] [strahd-arc]       │
│                                     │
│  [Save & Process]  [Keep as Draft]  │
└─────────────────────────────────────┘
```

#### Entity Quick-Create Panel

```
┌─────────────────────────────────┐
│  Create New Entity              │
│                                 │
│  Name: Henrik                   │
│  Type: [NPC ▾]                  │
│  Brief: Coffin maker in Vallaki │
│         coerced by vampires     │
│                                 │
│  [Create & Link]  [Cancel]      │
└─────────────────────────────────┘
```

#### Acceptance Criteria

1. A user can open a session notes panel from any screen in the application without navigating away from the current view.
2. As the user types entity names in the notes panel, recognized entities are underlined with a subtle highlight in real time.
3. Clicking a highlighted entity name opens a confirm/dismiss/create-new prompt.
4. Unrecognized text can be selected and promoted to a new entity via a quick-create panel requiring only name, type, and optional brief description.
5. A user can finalize a session by assigning a title, session number, date, summary note, and tags before saving.
6. After a session is saved, the session content is chunked and embedded into the knowledge base and is queryable through the agent.
7. A session log is never locked; a user can continue editing a saved session at any time.
8. Session notes are auto-saved locally so that a browser crash does not result in loss of unsaved content.

---

### 4.4 Session Prep Briefs

#### Overview
Before a session, the user opens the prep view and QuestLog assembles a structured brief from the campaign's accumulated knowledge. This is not generative fiction — it's a structured digest of real campaign state.

#### Brief Components

| Section | Source | Description |
|---|---|---|
| **"Previously on..."** | Last 1–2 session logs | Narrative summary of recent events. 2–3 paragraphs. Factual, not embellished (unless user's style profile says otherwise). |
| **Active plot threads** | All session logs + entity data | Ranked list of unresolved story arcs with last-touched date and brief status. |
| **Likely NPCs** | Graph proximity + recency | NPCs most likely to appear based on current location, active threads, and recent interactions. Quick-reference cards with motivation, last interaction, and key facts. |
| **Loose ends & flags** | Agent analysis across sessions | Things the DM mentioned but never resolved, questions players asked that went unanswered, promises made by NPCs, ticking clocks. |
| **Suggested follow-ups** | Agent-generated | 2–3 possible directions for the upcoming session based on current state. These are prompts, not scripts. |
| **Quick links** | Entity pages | Direct links to the most relevant entity pages for fast mid-session reference. |

#### User Interaction with Briefs
- Briefs are **generated on demand**, not on a schedule.
- Each section can be **collapsed, pinned, reordered, or dismissed**.
- Items can be **starred** for emphasis or **snoozed** to remove from this brief but resurface later.
- The user can **click into any section to open the agent chat** with that context pre-loaded: "Tell me more about this thread" → opens chat with that thread's context.
- Briefs are saved and can be reviewed later, providing a meta-record of how the campaign evolved.

#### Prep Brief UX Concept

```
┌──────────────────────────────────────────────────────────┐
│  📋 Session 10 Prep Brief                                │
│  Campaign: Curse of Strahd   Last session: March 8       │
│  ─────────────────────────────────────────────────────── │
│                                                           │
│  ▼ Previously On...                                      │
│  ┌───────────────────────────────────────────────────┐   │
│  │ The party recovered the bones of St. Andral from   │   │
│  │ Henrik's coffin shop, but not before a vampire     │   │
│  │ spawn nearly killed Ireena. The bones are restored │   │
│  │ but Henrik has gone missing...                     │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ▼ Active Threads (4)                          [sort ▾]  │
│  ┌───────────────────────────────────────────────────┐   │
│  │ ⚡ The Bones of St. Andral — RESOLVED this session │   │
│  │ 🔥 Izek's Obsession with Ireena — 3 sessions      │   │
│  │    Last: Izek was seen watching Ireena from the     │   │
│  │    town square. Party hasn't confronted him yet.    │   │
│  │ 🕐 The Festival of the Blazing Sun — upcoming      │   │
│  │ 💀 Strahd's Dinner Invitation — unanswered         │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ▼ Likely NPCs                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Izek     │ │ Ireena   │ │ Baron    │ │ Lady     │   │
│  │ Strazni  │ │ Kolyana  │ │ Vallako- │ │ Wachter  │   │
│  │ ──────── │ │ ──────── │ │ vich     │ │ ──────── │   │
│  │ Hostile  │ │ Allied   │ │ ──────── │ │ Unknown  │   │
│  │ Wants:   │ │ Wants:   │ │ Wants:   │ │ Wants:   │   │
│  │ Ireena   │ │ Safety   │ │ Order    │ │ Power    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                           │
│  ▼ Loose Ends                                            │
│  • Players asked about the "Amber Temple" — never       │
│    followed up. Source: Session 7 log.                    │
│  • The party promised to return Lady Wachter's book.     │
│    It's still in their inventory. Source: Session 5 log. │
│                                                           │
│  ▶ Suggested Follow-ups (click to expand)                │
│                                                           │
│              [Open Agent Chat]  [Save Brief]              │
└──────────────────────────────────────────────────────────┘
```

#### Acceptance Criteria

1. A user can open a session prep view and receive an auto-generated brief without any manual curation.
2. The brief includes a "Previously on…" section sourced from the most recent 1–2 session logs.
3. The brief includes an Active Threads section listing unresolved story arcs with their last-touched date.
4. The brief includes a Likely NPCs section with at least motivation and last-interaction data per NPC.
5. The brief includes a Loose Ends section surfacing unresolved flags from prior sessions.
6. Each section of the brief can be collapsed, pinned, or dismissed independently.
7. Clicking any item in the brief opens the agent chat with that item's context pre-loaded.
8. Generated briefs are saved and can be reviewed in a historical list.

---

### 4.5 Entity Graph & Relationship Map

#### Overview
Every NPC, location, faction, item, and story arc in the campaign has a dedicated entity page that accumulates context organically from session logs, imported material, and agent conversations. A visual relationship map shows how everything connects.

#### Entity Types

| Type | Icon | Key Fields |
|---|---|---|
| **NPC** | 👤 | Name, title/role, affiliation, motivation, status (alive/dead/unknown), physical description, personality notes |
| **Location** | 📍 | Name, region/parent location, description, notable features, current occupants |
| **Faction** | ⚔️ | Name, goal, alignment, known members, territory, status (active/disbanded/secret) |
| **Item** | 🔮 | Name, type (weapon/artifact/mundane), properties, current holder, origin |
| **Story Arc** | 📖 | Name, status (active/resolved/dormant), involved entities, key events, stakes |

#### Entity Page Structure
Each entity page is a living document assembled from multiple sources:

1. **Summary** — auto-generated one-paragraph overview, updated as new information arrives.
2. **Key Facts** — structured quick-reference fields (type-specific, see table above).
3. **Timeline** — chronological list of every mention across session logs and imported material, with context snippets.
4. **Relationships** — list of connected entities with relationship labels (allied with, enemy of, located in, member of, carries, etc.).
5. **Source References** — links to the specific session logs, documents, or conversations that contain information about this entity.
6. **DM Notes** — freeform section for the user's private annotations, plans, and secrets (see §4.6).
7. **Secret Facts** — information tagged as DM-only, visually distinguished (see §4.6).

#### Entity Pages Are Append-Only by Default
Entity pages grow automatically. When a session log mentions "Strahd," new information from that log is appended to Strahd's timeline and may update the summary. The user can always manually edit any section, but the default behavior is accumulation, not replacement. This means the entity page is always the most complete picture of that entity across the entire campaign.

#### Relationship Map (Visual)
An interactive node graph where:
- Each entity is a node, color-coded and icon-coded by type.
- Edges represent relationships, labeled and directional where relevant.
- Clicking a node opens the entity page in a side panel.
- The graph can be filtered by entity type, relationship type, or story arc.
- Zoom and pan for navigation. Auto-layout with manual adjustment.
- Cluster detection: entities that appear together frequently form visual groups.

#### Relationship Map UX Concept

```
┌────────────────────────────────────────────────────────────────┐
│  🗺️ Relationship Map — Curse of Strahd                        │
│  Filter: [All Types ▾] [All Arcs ▾]           [Zoom] [Reset] │
│  ──────────────────────────────────────────────────────────── │
│                                                                │
│             [Barovia]                                          │
│            ╱        ╲                                          │
│      [Castle       [Village of                                 │
│       Ravenloft]    Barovia]                                   │
│        │               │                                       │
│     [Strahd]───enemy──[Ireena]                                │
│        │                 │                                     │
│     controls          protected by                             │
│        │                 │                                     │
│     [Rahadin]        [Father                                   │
│                       Lucian]                                  │
│                          │                                     │
│                       at                                       │
│                          │                                     │
│                    [St. Andral's                                │
│                     Church]                                    │
│                                                                │
│  ── Hovered: Strahd von Zarovich ──────────────────────────── │
│  NPC · Vampire Lord · Motivation: Claim Ireena                │
│  Last seen: Session 9 · Relationships: 12                     │
│                                      [Open Entity Page →]     │
└────────────────────────────────────────────────────────────────┘
```

#### Entity Search
- **Fuzzy search** across all entity names, descriptions, and content.
- Powered by `pg_trgm` for typo-tolerant matching.
- Results ranked by relevance and recency.
- Search results show entity type, brief excerpt, and last-mentioned session.

#### Acceptance Criteria

1. Five entity types are supported: NPC, Location, Faction, Item, and Story Arc; each has a dedicated set of structured fields.
2. Saving a session log creates or updates entity pages for every entity referenced in that log.
3. An entity page displays a summary, key facts, a chronological timeline of mentions, and a list of relationships to other entities.
4. A user can manually create, edit, and delete entities at any time.
5. The visual relationship map renders entities as nodes color-coded by type and edges labeled with relationship type.
6. Clicking a node on the relationship map opens the entity page in a side panel without navigating away from the map.
7. The relationship map can be filtered by entity type and story arc.
8. Entity fuzzy search (via `pg_trgm`) returns relevant matches for partial and misspelled names.

---

### 4.6 Secret Management

#### Overview
Campaign information exists on a spectrum of visibility. Some facts are common knowledge, some are DM-only secrets, and some are known by specific NPCs or factions but not the party. QuestLog tracks this distinction so the agent can respect it and generated content (especially player-facing recaps) can be safely filtered.

#### Visibility Levels

| Level | Description | Behavior |
|---|---|---|
| **Player-known** | The party has learned this in-game. | Included in player recaps. Agent mentions freely. |
| **DM-only** | The DM knows this but the party does not. | Excluded from player recaps. Agent flags with a 🔒 icon when referencing. |
| **Revealed** | Was DM-only, now player-known. | Timestamped transition. Included in recaps from the reveal point forward. |

#### How Secrets Are Tagged
- Any entity field, fact, or note can be toggled between player-known and DM-only.
- Imported material defaults to **DM-only** (conservative approach — the DM reveals things deliberately).
- Session log content defaults to **player-known** (what happened at the table is known to the party).
- The user can override either default per-item.

#### Reveal Workflow
When the DM reveals a secret in-game:
1. Find the secret on the entity page or via agent chat ("reveal that Strahd is Ireena's ancestor").
2. Mark it as revealed. A timestamp and optional note ("revealed during session 9 dinner scene") are recorded.
3. The fact transitions to player-known and will appear in future recaps and player-safe outputs.

#### Agent Behavior with Secrets
- In **DM mode** (default): agent has full access to all information. Secrets are marked with 🔒 in responses so the DM can tell at a glance which information is player-known vs. hidden.
- In **player-safe mode** (toggled for recap generation): agent only uses player-known facts.

#### Acceptance Criteria

1. Any entity field, fact, or note can be toggled between player-known and DM-only visibility.
2. Imported material defaults to DM-only; session log content defaults to player-known; either default can be overridden per item.
3. When the DM reveals a secret, a timestamp and optional note are recorded alongside the visibility change.
4. In DM mode, agent responses that reference DM-only information display a visible 🔒 indicator on those facts.
5. In player-safe mode, agent responses contain no DM-only information, even if that information is present in the knowledge base.
6. Player-facing recap generation operates in player-safe mode by default and cannot be overridden to include DM-only facts.

---

### 4.7 Player-Facing Recaps

#### Overview
Generate narrative session recaps safe to share with players. These pull from session logs and player-known facts only, formatted for easy copy-paste to Discord or similar platforms.

#### Recap Configuration
- **Tone presets:** dramatic narrator, casual/conversational, in-character (from a specific NPC's perspective), journalistic/factual.
- **Length:** short (1 paragraph), medium (3–5 paragraphs), full (detailed narrative).
- **Custom tone:** if the user has configured a writing style profile (§4.9), the recap conforms to it.
- **Perspective options:** third-person omniscient, first-person from a narrator NPC, second-person ("you and your companions...").

#### Recap Workflow
1. User navigates to a completed session log.
2. Clicks "Generate Recap."
3. Selects tone, length, and perspective.
4. System generates the recap using only player-known information.
5. User reviews, edits if desired, and copies to clipboard.

#### Safety Guarantee
The recap generation explicitly filters out any DM-only facts. If a session log contains DM notes or secret tags, those are excluded from the recap's source context. The agent is instructed with a hard constraint: "This output will be shared with players. Do not include any DM-only information."

#### Acceptance Criteria

1. A user can generate a recap from any saved session log by clicking "Generate Recap."
2. The user can configure tone (dramatic, casual, in-character, journalistic), length (short/medium/full), and perspective (first/second/third person) before generation.
3. The generated recap contains no DM-only facts, regardless of what is present in the session log or knowledge base.
4. The user can edit the generated recap before copying it.
5. The recap is copyable to clipboard with a single action.
6. If a campaign-wide style profile is configured, the recap conforms to that style unless a different tone is selected explicitly.

---

### 4.8 At-the-Table Reference Features

These features are lower priority but high everyday value. They support running an in-person session without replacing the physical game table.

#### 4.8.1 Map Reference

**What it does:** Upload an image (dungeon map, region map, battle map, any image). Annotate it with area-by-area notes. During a session, tap an area to see your notes.

**Annotation model:**
- The user uploads an image.
- They define **clickable regions** by drawing rectangles or polygons on the map (or, for simpler UX, placing numbered pins).
- Each region has a note: what's here, traps, enemies, loot, environmental details, connections to other areas.
- Notes can link to entities.

**Mid-session use:** Tap a region → note pops up in an overlay. Dismiss with a tap elsewhere. No mode switching, no navigation away from the map.

**Agent integration:** The agent can reference map annotations. "What's between the party and the throne room?" → agent traces through annotated regions.

**Map Reference UX Concept:**

```
┌────────────────────────────────────────────────────────────┐
│  🗺️ Death House — Ground Floor                             │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                                                      │ │
│  │    ┌─────┐   ┌─────────────┐   ┌─────┐             │ │
│  │    │  1  │───│      2      │───│  3  │             │ │
│  │    │     │   │             │   │     │             │ │
│  │    └──┬──┘   └──────┬──────┘   └─────┘             │ │
│  │       │             │                               │ │
│  │    ┌──┴──┐   ┌──────┴──────┐                       │ │
│  │    │  4  │   │      5      │  ← tapped             │ │
│  │    │     │   │             │                       │ │
│  │    └─────┘   └─────────────┘                       │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ Room 5: Dining Hall ────────────────────────────────┐ │
│  │ Long table set for a ghostly feast. Dust everywhere. │ │
│  │ Trap: animated armor activates if food is touched.   │ │
│  │ Loot: silver serving set (25gp) in the cabinet.     │ │
│  │ Connects to: Room 2 (north), Basement (trapdoor)    │ │
│  │ Entities: [Ghost of Gustav Durst]                    │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

#### 4.8.2 Combat Tracker

**What it does:** A simple initiative order list with HP tracking. A personal scratch pad, not a rules engine.

**Features:**
- Add combatants: name, initiative roll, max HP, optional notes (AC, key abilities as freeform text).
- Sort by initiative (auto or manual).
- Track current turn with a highlight.
- Increment/decrement HP with tap buttons.
- "Next turn" button advances the tracker.
- Combatants can be flagged: alive, dead, fled, concentrating.
- Quick-add from entities: if you have an NPC entity with stats, one-tap to add them to initiative.

**What it does NOT do:** Automated attack rolls, condition tracking, action economy enforcement, spell slot management, rules adjudication.

**Combat Tracker UX Concept:**

```
┌───────────────────────────────────────────────────────┐
│  ⚔️ Initiative — Encounter: Coffin Shop Ambush        │
│  Round 3                                [End Combat]  │
│  ─────────────────────────────────────────────────── │
│                                                       │
│  ▶ Kael (PC)           Init: 19   HP: 34/45         │
│    Rogue · AC 16                          [-] [+]    │
│                                                       │
│    Vampire Spawn #1    Init: 17   HP: 12/52  💀     │
│    AC 15 · Regen 10/turn                  [-] [+]    │
│                                                       │
│    Elara (PC)          Init: 14   HP: 28/28         │
│    Cleric · AC 18 · ✨ Concentrating     [-] [+]    │
│                                                       │
│    Vampire Spawn #2    Init: 11   HP: 52/52         │
│    AC 15 · Regen 10/turn                  [-] [+]    │
│                                                       │
│    Henrik (NPC)        Init: 3    HP: 8/8           │
│    Cowering behind counter                [-] [+]    │
│                                                       │
│           [← Prev Turn]  [Next Turn →]               │
│                                                       │
│  [+ Add Combatant]  [Quick Add from Entities]        │
└───────────────────────────────────────────────────────┘
```

#### 4.8.3 Quick Reference Lookup

**What it does:** Fast answers to mid-session questions — spell descriptions, item stats, rule clarifications — from both imported material and general TTRPG knowledge.

**Implementation:** This is a specialized mode of the agent conversation. The user can invoke it from a quick-action bar or a keyboard shortcut. The agent responds with a brief, formatted answer (card-style, not conversational).

**Example interactions:**
- "fireball" → spell card with range, damage, save DC, area.
- "grapple rules" → concise rules summary.
- "potion of healing" → item card with effect and cost.

#### Acceptance Criteria

##### 4.8.1 Map Reference
1. A user can upload an image as a map and annotate it with numbered pins or rectangular regions.
2. Each annotated region has a freeform note that can link to entities.
3. Tapping a region during a session shows the note as an overlay without navigating away from the map.
4. The overlay dismisses with a single tap outside it.

##### 4.8.2 Combat Tracker
1. A user can add combatants with name, initiative roll, max HP, and optional notes; the list auto-sorts by initiative.
2. A user can increment or decrement combatant HP with tap buttons; HP never goes below 0 in the display.
3. The current turn is highlighted; "Next Turn" advances to the next combatant in initiative order.
4. The tracker can be reset or an encounter can be saved and re-loaded.

##### 4.8.3 Quick Reference Lookup
1. A user can invoke quick reference from any screen with a keyboard shortcut or action bar tap.
2. Queries that exactly match a known entity return an entity card without an LLM call.
3. Other queries return a terse, card-formatted response in under 5 seconds.
4. The quick reference result does not persist as a regular conversation message; it is ephemeral.

---

### 4.9 Tonal & Writing Style Customization

#### Overview
The user provides samples of their own writing — flavor text, NPC dialogue, scene descriptions, narration — and the system extracts a style profile. All generated content then conforms to that voice.

#### Style Profile System
- **Campaign-wide default:** extracted from the user's session logs and any provided writing samples. Applied to all generated content unless overridden.
- **Named style templates:** user-created presets like "gritty noir," "high fantasy purple prose," "dry academic." These can be applied on the fly to any generation request.
- **Per-entity overrides:** specific NPCs or narrators can have their own voice. "This NPC speaks in flowery riddles" is stored on the entity and used when generating dialogue for them.
- **Per-content-type overrides:** recaps might use one style, prep briefs another, NPC dialogue a third.

#### Style Extraction
When the user provides writing samples:
1. The system analyzes vocabulary, sentence structure, tone, formality level, use of figurative language, pacing, and dialogue style.
2. A structured style profile is generated (stored as a system prompt fragment).
3. The user can review and tweak the profile in plain language: "Make it slightly more formal" or "Less metaphor."

#### Application Hierarchy
When generating content, the system resolves style in this order (most specific wins):
1. Explicit user instruction in the current prompt ("write this in a noir style").
2. Per-entity override (if generating content for a specific entity that has one).
3. Per-content-type override (if the content type has a configured style).
4. Named template (if the user selected one).
5. Campaign-wide default.
6. System default (clear, functional prose).

#### Acceptance Criteria

1. A user can provide writing samples; the system produces a structured style profile from those samples.
2. A user can create, save, and apply named style templates (e.g., "gritty noir," "high fantasy").
3. A specific entity can have a per-entity voice override that applies when generating content about that entity.
4. Style application follows the resolution hierarchy: explicit instruction > per-entity override > per-content-type > named template > campaign default > system default.
5. All generation endpoints (recaps, prep briefs, agent chat) respect the active style profile when one is configured.
6. A user can preview a style profile by generating a short sample passage without committing to a full generation.

---

## 5. Design System & UX Concepts

> **Full specification:** `Docs/DESIGN_SYSTEM.md`
>
> This section summarizes the design direction. All token values, component specs, interaction states, and implementation details live in the dedicated design system document.

### Design Philosophy

QuestLog should feel like a **creative command center**, not a project management tool. Dark mode first (DMs prep at night). The agent chat is the primary interface, not a sidebar feature. Meaningful motion communicates state; gratuitous animation is cut.

**Core principle: Entities are the color system.** There is no single "accent color." Instead, each entity type (NPC, faction, location, item, story arc) has its own hue within the blue-green spectrum. The background stays deeply neutral so entity colors pop. When scanning a paragraph, a user should instantly perceive the types of entities mentioned without reading labels.

### Visual Direction

- **Palette:** Deep navy-black base (#090d12) with a four-plane depth system (void → surface → elevated → focal). Cool-toned entity accent colors across the blue-green spectrum.
- **Typography:** Crimson Pro (display/headings), DM Sans (body), JetBrains Mono (mono/code).
- **Layout:** 56px icon rail + main content + toggleable 300px right panel (context or session notes).
- **Signature interaction:** Entity hover cards — hovering any entity name in the app surfaces a rich summary card tinted with that entity type's color, with pin and open actions.

### Entity Color Mapping

| Entity Type | Color | Hex | Rationale |
|-------------|-------|-----|-----------|
| NPC | Bright blue | `#60b8ff` | High energy — characters drive action |
| Faction | Emerald green | `#40d8a0` | Organized groups, alliances |
| Location | Soft periwinkle | `#a0b8ff` | Spatial, grounding |
| Item | Teal | `#80d8d8` | Tangible objects |
| Story Arc | Soft violet | `#c0a0ff` | Narrative threads, abstract |

Primary actions (send button, active nav) use NPC blue (`#60b8ff`) since it's the highest-energy entity hue and NPCs are the most frequently referenced type.

### Mascot System

Unchanged — see `Docs/DESIGN_SYSTEM.md` §10. The animated companion character (dragon "Ember" in fantasy theme) serves as an ambient status indicator: sleeping when idle, eating scrolls during import, thinking during agent queries, confused on errors.

### Campaign Themes

Each theme overrides CSS custom properties for backgrounds, text, accent, and typography. Entity colors remain constant across all themes to ensure consistent entity recognition. See `Docs/DESIGN_SYSTEM.md` §11 for full theme definitions.

| Theme | Mascot | Accent | Font Flavor |
|-------|--------|--------|-------------|
| **Fantasy** (default) | Dragon | Blue `#60b8ff` | Serif display + clean sans body |
| **Sci-Fi** | Robot | Cyan `#00e5ff` | Monospace display + geometric sans body |
| **Horror** | Raven | Magenta `#c850c0` | Serif display + thin serif body |
| **Western** | Coyote | Amber `#e09040` | Serif display + rustic sans body |
| **Modern** | Street cat | Blue `#4a90d9` | Grotesque sans throughout |

### Key Interaction Patterns

**Progressive disclosure:** New users see a clean, simple interface. Advanced features (style profiles, secret management, map annotations) are discoverable but not in-your-face. First-time setup is guided: create campaign → pick theme → import something → start chatting.

**The agent is always accessible:** A persistent chat input is available from any screen (collapsible, not intrusive). You can ask a question while looking at the entity graph, the map, or the prep brief without switching views.

**Everything is linkable internally:** Entity names in any context (chat, session notes, prep briefs, entity pages) are hoverable (showing summary cards) and clickable (navigating to their entity page).

**Command palette (⌘K):** Global search across entities, sessions, conversations, and commands. Available from any screen.

---

## 6. High-Level Architecture

### Stack Summary

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React + Tailwind CSS | Web-first (deliberate growth area), utility-first CSS for rapid iteration |
| **API Layer** | tRPC | End-to-end TypeScript type safety, no code generation, excellent DX |
| **Backend Runtime** | Node.js + Fastify | Fast, lightweight, good tRPC integration |
| **Database** | PostgreSQL | JSONB for flexible entity schemas, `pgvector` for embeddings, `pg_trgm` for fuzzy search, recursive CTEs for graph traversal |
| **ORM** | Drizzle | Type-safe, SQL-close, lightweight |
| **AI/LLM** | Anthropic Claude API (or OpenAI) | Conversation, content generation, style matching |
| **Embedding** | Voyage AI `voyage-4-lite` (1024 dimensions) | Vector embeddings for RAG retrieval |
| **Infra** | Fly.io or Railway | Managed deployment, good Postgres support |
| **CI/CD** | GitHub Actions | Standard, familiar, extensible |
| **Containerization** | Docker | Consistent environments, deployable anywhere |

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Agent   │ │ Session  │ │  Entity  │ │  Map /   │      │
│  │  Chat    │ │  Logger  │ │  Graph   │ │ Combat   │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       └─────────────┴────────────┴─────────────┘            │
│                         │ tRPC                               │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                    Backend (Fastify + tRPC)                   │
│                         │                                    │
│  ┌──────────────────────┼──────────────────────────────┐    │
│  │              tRPC Router Layer                       │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │    │
│  │  │ Campaign │ │ Session  │ │  Entity  │  ...      │    │
│  │  │ Router   │ │ Router   │ │  Router  │           │    │
│  │  └──────────┘ └──────────┘ └──────────┘           │    │
│  └─────────────────────────────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┼──────────────────────────────┐    │
│  │              Service Layer                           │    │
│  │                      │                               │    │
│  │  ┌─────────────┐ ┌──┴──────────┐ ┌──────────────┐  │    │
│  │  │  Import     │ │  RAG        │ │  Entity      │  │    │
│  │  │  Pipeline   │ │  Pipeline   │ │  Service     │  │    │
│  │  │             │ │             │ │              │  │    │
│  │  │ • Extract   │ │ • Embed     │ │ • CRUD       │  │    │
│  │  │ • Chunk     │ │ • Retrieve  │ │ • Link       │  │    │
│  │  │ • Embed     │ │ • Assemble  │ │ • Graph      │  │    │
│  │  │ • Suggest   │ │ • Generate  │ │ • Search     │  │    │
│  │  └─────────────┘ └─────────────┘ └──────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────┼──────────────────────────────┐    │
│  │              Data Layer (Drizzle ORM)                │    │
│  └──────────────────────┼──────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                    PostgreSQL                                 │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │  Relational  │ │  pgvector    │ │  pg_trgm         │    │
│  │  Tables      │ │  (embeddings)│ │  (fuzzy search)  │    │
│  │              │ │              │ │                   │    │
│  │  campaigns   │ │  chunks      │ │  GIN indexes on  │    │
│  │  sessions    │ │  (content +  │ │  entity names,   │    │
│  │  entities    │ │   vector)    │ │  descriptions    │    │
│  │  relations   │ │              │ │                   │    │
│  │  sources     │ │              │ │                   │    │
│  │  conversations│ │             │ │                   │    │
│  └──────────────┘ └──────────────┘ └──────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  JSONB: flexible entity attributes, style profiles,  │   │
│  │  map annotations, combat state                        │   │
│  │  Recursive CTEs: graph traversal for relationships    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

External Services:
┌──────────────┐  ┌──────────────┐
│  LLM API     │  │  Embedding   │
│  (Claude)    │  │  API         │
│              │  │  (Voyage AI) │
└──────────────┘  └──────────────┘
```

### RAG Pipeline (High Level)

The retrieval-augmented generation pipeline is the core intelligence layer. At a high level:

**Ingestion (write path):**
1. Raw content (PDF, markdown, text) → text extraction.
2. Text → semantic chunking (respect section boundaries, ~500–1000 tokens per chunk).
3. Chunks → embedding via API → stored in `pgvector`.
4. Chunks → entity extraction (NER) → suggested entity links.
5. Metadata tagging: source document, chunk position, entity mentions, visibility level.

**Retrieval (read path):**
1. User query → embed the query.
2. Vector similarity search against campaign's chunks (top-k, filtered by campaign).
3. Entity extraction from query → graph traversal to pull entity context.
4. Recency boost: weight recent session log chunks higher for "current state" queries.
5. Assemble context window: relevant chunks + entity summaries + conversation history + campaign metadata.
6. Send assembled context + query to LLM.
7. LLM response → post-process (add source citations, flag secrets, apply style).

**Key architectural decisions deferred to technical design doc:**
- Specific chunking strategy and overlap.
- Embedding model selection and dimensionality.
- Retrieval scoring weights (vector similarity vs. graph proximity vs. recency).
- Context window budget allocation.
- Prompt template design.
- Streaming vs. batch response delivery.

---

## 7. Non-Goals & Explicit Exclusions

To keep v1 focused, the following are explicitly out of scope:

- **Virtual tabletop features:** No shared player view, token movement, fog of war, or real-time multiplayer game board.
- **Character builder / rules engine:** No automated character creation, leveling, or rules adjudication beyond what the agent can answer conversationally.
- **Multi-user / multiplayer:** Single user only. No player accounts, no shared campaigns, no real-time collaboration.
- **Mobile native app:** Web only (responsive, but no React Native or native mobile build).
- **Offline support:** Requires internet for LLM and embedding API calls. Local-first is a future consideration.
- **SaaS infrastructure:** No auth system, billing, multi-tenancy, or user management. This is a single-user tool.
- **Automated map generation:** Maps are uploaded and annotated, not procedurally generated.
- **Voice input/output:** Text only for v1.
- **Integration with VTTs or other tools:** No Foundry modules, Roll20 API integration, or D&D Beyond sync.
- **Content marketplace:** No sharing campaigns, templates, or generated content with other users.

---

## 8. Risks & Open Questions

### Technical Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **RAG quality** — retrieval returns irrelevant context, agent confabulates | High | Invest in chunking strategy, test with real campaign data early, add source citations for verifiability |
| **PDF extraction quality** — published modules have complex layouts (columns, sidebars, stat blocks) | Medium | Test with actual D&D PDFs early. Fall back to manual paste for difficult layouts. Consider specialized PDF parsers. |
| **Context window limits** — large campaigns exceed what can fit in a single LLM call | Medium | Smart context assembly, summarization of older material, entity summaries as compressed representations |
| **Embedding cost** — large campaigns with many documents could get expensive | Low | Chunk efficiently, cache embeddings, use cost-effective embedding models (Voyage AI voyage-4-lite) |
| **Entity linking accuracy** — NER on fantasy names is unreliable | Medium | Use the campaign's own entity list as a dictionary for matching. Suggest, don't auto-commit. Let the user correct. |

### Product Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Scope creep** — every feature is interesting, timeline slips | High | This PRD defines the cut line. Ruthlessly defer anything not specified here. |
| **Polish vs. shipping** — design ambition conflicts with timeline | Medium | Ship functional first, polish iteratively. Theming can start as a single theme (fantasy) with others added later. |
| **Adoption friction** — DMs won't import 200 pages of material to try a tool | Medium | Make the zero-import experience still valuable (paste a paragraph, ask a question). Progressive onboarding. |

### Open Questions

1. **LLM provider:** Claude vs. OpenAI vs. both? Implications for cost, quality, and API design.
2. ~~**Embedding model:** Voyage AI voyage-3 (1024 dimensions, recommended by Anthropic). Alternatives? Self-hosted?~~ **Resolved (2026-03-17):** Using Voyage AI `voyage-4-lite` — same $0.02/MTok cost as OpenAI text-embedding-3-small, supports `input_type` query/document differentiation for better retrieval quality, 1024-dim vectors (compatible with existing `pgvector` schema), 200M free token tier, top-tier MTEB scores. Upgraded from `voyage-3` to `voyage-4-lite` for improved quality at no cost increase.
3. **Entity extraction approach:** LLM-based NER vs. rule-based matching against known entity list vs. hybrid?
4. **Graph visualization library:** D3.js, Cytoscape.js, react-force-graph, or something else?
5. **Rich text editor:** TipTap, Slate, Lexical, or ProseMirror? Needs to support inline entity linking.
6. **Sprite animation approach:** CSS sprite sheets, Lottie, canvas-based, or SVG animation?
7. **Single theme for v1?** Ship fantasy-only and add themes incrementally?
8. **Hosting decision:** Fly.io vs. Railway vs. other? Managed Postgres implications?

---

## 9. Milestone Plan

*This section is a high-level sketch. A detailed sprint plan with weekly deliverables should be created as a separate document once the PRD is finalized.*

### Phase 1: Foundation (Weeks 1–2)
- Project setup: monorepo, TypeScript config, Fastify + tRPC scaffolding, Drizzle + Postgres.
- Database schema: campaigns, sessions, entities, relationships, chunks.
- Basic frontend shell: React + Tailwind, routing, layout scaffolding.
- File upload + text extraction pipeline (PDF, markdown, text).
- Embedding pipeline: chunking → Voyage AI embeddings → pgvector storage.
- Basic agent chat: send query → retrieve context → call LLM → display response.

### Phase 2: Core Loop (Weeks 3–4)
- Session log editor with entity detection and inline linking.
- Entity CRUD: create, view, edit entity pages.
- Entity relationship tracking (manual + auto-suggested from co-occurrence).
- Session prep brief generation.
- Secret management: visibility tagging, agent behavior with secrets.
- Player recap generation.

### Phase 3: At-the-Table & Polish (Weeks 5–6)
- Map upload and annotation system.
- Combat tracker.
- Quick reference lookup mode.
- Relationship map visualization.
- Mascot animations (at least one theme — fantasy dragon).
- Campaign theming (fantasy default, at least one additional).
- Responsive layout for tablet use.
- UX polish pass: loading states, error handling, transitions.

### Phase 4: Style & Refinement (Week 7+)
- Style profile extraction and application.
- Named style templates.
- Additional campaign themes.
- Performance optimization.
- Real-campaign testing: run it through an actual multi-session campaign arc.

---

*This is a living document. Sections will be refined, reordered, and expanded as design and technical decisions are made. Open questions should be resolved and documented here as they are answered.*
