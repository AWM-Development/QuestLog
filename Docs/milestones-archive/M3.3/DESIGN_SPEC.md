# Task 3.3 — Chat UI Implementation Spec

**Branch:** `feat/agent-chat/chat-ui`
**PRD ref:** §4.2 Agent Chat UX Concept
**Design ref:** `Docs/DESIGN_SYSTEM.md` §7.2–7.5

**Prerequisites:** Tasks 3.1 (context assembly) and 3.2 (LLM integration & streaming) must be complete. The conversation router (`apps/server/src/routers/conversation.ts`) already exposes `create`, `list`, `getMessages`, and `chat` procedures.

---

## 1. Overview

Build the full agent chat UI: message list with streaming, conversation management (create/switch/title/archive/tag), source citations, and a related-entities context panel. This is the primary interface of QuestLog — it occupies center stage in the layout.

---

## 2. Layout Architecture

### 2.1 Grid Structure

The chat page adds a **conversation drawer** to the existing rail + main + panel layout. The drawer lives _inside_ the main content area (not as an app-level layout column), so it's scoped to the chat feature.

```
Desktop (≥1200px), drawer open, panel open:
┌──────┬────────────┬───────────────────────────┬──────────────┐
│ Rail │  Drawer    │     Chat Messages          │    Panel     │
│ 56px │  240px     │     (flex 1)               │    300px     │
│      │ (pushes)   │                            │ (toggleable) │
└──────┴────────────┴───────────────────────────┴──────────────┘

Desktop, drawer closed, panel closed:
┌──────┬────────────────────────────────────────────────────────┐
│ Rail │              Chat Messages (full width)                │
│ 56px │                                                        │
└──────┴────────────────────────────────────────────────────────┘
```

### 2.2 Responsive Behavior

| Breakpoint | Rail | Drawer | Panel |
|---|---|---|---|
| Desktop ≥1200px | Visible (56px) | Pushes content (240px) | Pushes content (300px) |
| Tablet 768–1199px | Visible (56px) | **Overlay** with scrim, dismisses on outside tap | **Overlay** with scrim |
| Mobile <768px | Hidden, replaced by bottom tab bar | Full-screen sheet | Full-screen sheet |

**Key behavior change:** On tablet, the drawer does NOT push the chat content. It overlays with a semi-transparent scrim (`rgba(9,13,18,0.5)`) behind it. Tapping the scrim or pressing the ☰ toggle closes it. This ensures the chat area always has full width minus the 56px rail on tablet.

### 2.3 Drawer Toggle

The ☰ icon in the chat header toggles the drawer. State should persist in localStorage so it remembers the user's preference across page reloads (but defaults to **closed** on first visit).

The panel toggle is the "◧ Context" button in the header. Active state: blue text + blue border + `--accent-muted` background.

---

## 3. Route Structure

```
/campaign/:campaignId/chat                → ChatPage (no conversation selected, show empty state)
/campaign/:campaignId/chat/:conversationId → ChatPage (conversation loaded)
```

When a new conversation is created, navigate to `/campaign/:campaignId/chat/:conversationId`. When the user visits `/chat` without a conversation ID, show the empty/new conversation state.

---

## 4. File Structure

All new files go under `apps/web/src/features/agent-chat/`:

```
features/agent-chat/
├── components/
│   ├── ChatPage.tsx           — Route-level container, manages layout
│   ├── ChatHeader.tsx         — Header bar with title, toggles, campaign badge
│   ├── ConversationDrawer.tsx — Left drawer with conversation list
│   ├── ConversationListItem.tsx — Single conversation row
│   ├── MessageList.tsx        — Scrollable message container
│   ├── UserMessage.tsx        — Right-aligned user bubble
│   ├── AgentMessage.tsx       — Left-aligned agent response with citations
│   ├── SourceChip.tsx         — Clickable source citation pill
│   ├── SuggestedAction.tsx    — Pre-filled prompt button below agent messages
│   ├── ChatInput.tsx          — Input bar with send button
│   ├── ConversationTags.tsx   — Tag display + inline editor popover
│   ├── StreamingCursor.tsx    — Blinking blue cursor component
│   ├── ChatEmptyState.tsx     — Empty state with starter prompts
│   └── ChatErrorMessage.tsx   — Error/retry display for failed responses
├── hooks/
│   ├── useChat.ts             — Chat mutation, optimistic updates, streaming state
│   ├── useConversations.ts    — Conversation CRUD (list, create, archive, update title/tags)
│   └── useAutoScroll.ts       — Auto-scroll with pause-on-scroll-up
├── api.ts                     — tRPC hook wrappers
└── index.ts                   — Public exports
```

---

## 5. Component Specifications

### 5.1 ChatPage.tsx

The route-level container. Manages:
- Active conversation ID (from URL params)
- Drawer open/closed state (persisted to localStorage)
- Panel open/closed state

```tsx
// Simplified structure
<div className="chat-page" style={chatPageStyle}>
  {drawerOpen && <ConversationDrawer />}
  <div style={chatMainStyle}>
    <ChatHeader
      onToggleDrawer={...}
      onTogglePanel={...}
      panelOpen={panelOpen}
    />
    {conversationId ? <MessageList /> : <ChatEmptyState />}
    <ChatInput />
  </div>
  {panelOpen && <ContextPanel />}
</div>
```

**Style approach:** Use inline styles with CSS custom properties per project convention. The chat page grid adjusts based on drawer/panel state:

```tsx
const chatPageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  height: '100%',       // fills the main content area from AppLayout
  overflow: 'hidden',
};
```

### 5.2 ChatHeader.tsx

Spans the top of the chat main area.

**Contents (left to right):**
1. ☰ drawer toggle (28×28px, `--r-sm` radius)
2. Campaign badge — pill with `--accent-muted` bg, `--ent-npc-border` border, campaign name + ▾. Clicking opens campaign switcher (future — for now, display only).
3. Conversation title — `var(--font-display)`, 17px, weight 600. Shows "New conversation" in italic + muted color when no conversation is selected. **Editable on click:** clicking the title turns it into an inline input. Press Enter to save, Escape to cancel. Calls `trpc.conversation.update` (note: you'll need to add an `update` procedure to the conversation router — see §8 Backend Additions).
4. Tags — inline tag pills with × to remove, plus a "+ tag" button that opens the tag popover (see §5.11).
5. (flex spacer)
6. Command palette trigger — `--bg-elevated` bg, "🔍 Search..." + ⌘K badge. **Display only for 3.3** — wiring up ⌘K is a future milestone.
7. "📝 Notes" button — default state (future: toggles session notes tab in panel)
8. "◧ Context" button — toggle for right panel. Active state: `color: var(--accent); border-color: var(--ent-npc-border); background: var(--accent-muted)`

**Button states** (from DESIGN_SYSTEM.md §7.2):
- Default: `color: var(--text-muted); border: 0.5px solid var(--border)`
- Hover: `color: var(--text-secondary); border-color: var(--border-hover)`
- Active (toggled): `color: var(--accent); border-color: var(--ent-npc-border); background: var(--accent-muted)`

### 5.3 ConversationDrawer.tsx

240px wide left panel. Background: `var(--bg-surface)` (`#0b1118`). Border-right: `0.5px solid var(--border)`.

**Contents (top to bottom):**
1. Header row — "CONVERSATIONS" label (11px, uppercase, `--text-dim`, 0.5px letter-spacing) + "+" new conversation button (24×24px, `--r-sm`, `--accent-muted` bg, `--accent` text)
2. Search input — `--bg-elevated` bg, `--border` border, `--r-sm` radius, 11px placeholder "Search conversations..."
3. Scrollable conversation list

**On tablet (768–1199px):** Renders as an overlay:
```tsx
// Tablet overlay behavior
const drawerOverlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 56, // after rail
  bottom: 0,
  width: 240,
  zIndex: 20,
  background: 'var(--bg-surface)',
  borderRight: '0.5px solid var(--border)',
  // animation: slide in from left
};

const scrimStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  left: 56,
  zIndex: 19,
  background: 'rgba(9,13,18,0.5)',
};
```

Detect tablet via a `useMediaQuery` hook checking `(max-width: 1199px)`.

### 5.4 ConversationListItem.tsx

Single row in the conversation list.

**Props:**
```tsx
interface ConversationListItemProps {
  conversation: {
    id: string;
    title: string | null;
    tags: string[];
    status: string;
    updatedAt: Date;
  };
  isActive: boolean;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
}
```

**Layout:**
- Title: 12px, weight 500, `--text-primary`. Truncate with ellipsis. Falls back to "Untitled conversation" in muted italic if title is null.
- Timestamp: 10px, `--text-dim`. Use relative format: "2 min ago", "1 hour ago", "Yesterday", "Mar 15".
- Tags: flex row, gap 3px. Each tag is 9px, `--r-sm` radius, colored background/text. Use a consistent color mapping (hash the tag string to pick from a set of muted entity colors).

**States:**
- Default: transparent background
- Active: `background: rgba(96,184,255,0.06); border: 0.5px solid rgba(96,184,255,0.12)`
- Hover (non-active): `background: rgba(208,228,240,0.03)`. Shows action icons on the right edge:
  - ✏️ edit title (22×22px)
  - 🗑 archive (22×22px, `--status-danger` color at 0.5 opacity)

**Archive flow:**
1. Click archive icon → conversation disappears from list with a slide-out animation
2. Toast appears at bottom of drawer: "Conversation archived" + "Undo" link (blue)
3. Undo window: 5 seconds. If clicked, conversation reappears. If not, status is committed.
4. Implementation: optimistic UI removal, setTimeout for commit, clearTimeout on undo.

### 5.5 MessageList.tsx

Scrollable container holding all messages for the active conversation.

**Behavior:**
- Loads messages via `trpc.conversation.getMessages`
- Auto-scrolls to bottom on new messages (see `useAutoScroll` hook)
- Shows loading skeleton while messages are being fetched
- Shows `ChatEmptyState` if no messages exist

**Style:**
```tsx
const messageListStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '24px 20px',     // --space-6 vertical, --space-5 horizontal
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',               // --space-6 between messages
};
```

**Loading skeleton:** 3 gray bars of decreasing width (85%, 72%, 60%) with subtle pulse animation. Show the agent header (green dot + "QuestLog") above, with status text: "Loading messages..."

### 5.6 UserMessage.tsx

Right-aligned chat bubble.

**Style (from DESIGN_SYSTEM.md §7.3):**
```tsx
const userMessageStyle: CSSProperties = {
  maxWidth: '60%',
  marginLeft: 'auto',       // right-align
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: '14px 14px 4px 14px',  // flat bottom-right
  padding: '12px 16px',
  fontSize: '14px',
  color: 'var(--text-primary)',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',   // preserve line breaks from user input
};
```

### 5.7 AgentMessage.tsx

Left-aligned agent response. The most complex message component.

**Structure:**
```
┌─ Header: green dot (6px) + "QuestLog" label ──────────────────┐
│                                                                 │
│  Response text with **bold**, entity links, markdown rendering  │
│                                                                 │
│  [📄 source.pdf p.42] [📋 Session 6] [🧩 Entity Name]        │ ← SourceChips
│                                                                 │
│  [Generate dialogue] [Plan encounter] [Ask follow-up]           │ ← SuggestedActions
└─────────────────────────────────────────────────────────────────┘
```

**Props:**
```tsx
interface AgentMessageProps {
  content: string;
  sources?: MessageSource[];
  isStreaming?: boolean;
  // citations parsed from content and sources array
}
```

**Text rendering:**
- The agent's `content` is plain text (from the LLM). For v1, render with basic markdown support: **bold** → `<strong>`, line breaks, paragraphs. Use a lightweight markdown renderer or manual parsing — avoid pulling in a full markdown library unless already in the bundle.
- Entity links: The agent may reference entity names. For v1, these are **not** automatically detected. They appear as plain text. Entity link detection is a future milestone. However, structure the component so that entity link rendering can be plugged in later.
- Streaming: when `isStreaming` is true, append `<StreamingCursor />` after the last character.

**Style:**
```tsx
const agentMessageStyle: CSSProperties = {
  maxWidth: '88%',
  // No background — transparent
  fontSize: '14px',
  color: 'var(--text-secondary)',
  lineHeight: 1.75,
};

const agentHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '8px',
};

// Green dot
const statusDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--status-success)',
};

// "QuestLog" label
const agentLabelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--text-muted)',
};
```

**Strong text** within agent responses: `color: var(--text-primary); font-weight: 500`.

### 5.8 SourceChip.tsx

Clickable pill below agent messages. Color-coded by source type.

**Props:**
```tsx
interface SourceChipProps {
  source: MessageSource; // { chunkId, sourceName, sourceId }
  onClick?: () => void;
}
```

**Source type detection:** Determine type from `sourceName`:
- Contains ".pdf", ".md", ".txt", or ".docx" → document source (blue: `--ent-npc` tokens)
- Contains "session" (case-insensitive) → session source (green: `--ent-faction` tokens)
- Otherwise → entity source (purple: `--ent-location` tokens... or use `--ent-story-arc` purple)

**Style per type:**

| Type | Background | Text | Border |
|---|---|---|---|
| Document | `var(--ent-npc-bg)` | `var(--ent-npc)` | `var(--ent-npc-border)` |
| Session | `var(--ent-faction-bg)` | `var(--ent-faction)` | `var(--ent-faction-border)` |
| Entity | `var(--ent-location-bg)` | `var(--ent-location)` | `var(--ent-location-border)` |

All chips: `border-radius: var(--r-pill)`, padding `3px 10px`, font-size 11px. Add a small icon prefix (📄, 📋, 🧩) before the source name.

**Click behavior:** For v1, clicking a source chip is a no-op (or logs to console). Future: navigate to the source document or entity page. Structure the onClick handler so this can be wired up later.

### 5.9 SuggestedAction.tsx

Pre-filled prompt buttons below agent messages.

**Note:** For v1, suggested actions are **not generated by the agent** — the backend doesn't produce them yet. Omit the suggested actions row entirely for now. However, **build the component** so it's ready when the backend adds suggested actions to the response. Export it and leave it unused in `AgentMessage` with a commented-out section showing where it plugs in.

**Style (from DESIGN_SYSTEM.md §7.3):**
```tsx
const actionStyle: CSSProperties = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: '0.5px solid var(--border)',
  background: 'rgba(14,24,32,0.6)',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'all 150ms ease',
};

// Hover: color: var(--accent), border: var(--ent-npc-border),
//        background: var(--accent-muted), transform: translateY(-1px)
```

Clicking sends the action text as a user message.

### 5.10 ChatInput.tsx

Input bar at the bottom of the chat area.

**Layout:**
```
┌──────────────────────────────────────────────┬──────┐
│  Textarea (auto-growing)                      │  ↑   │ ← Send button
└──────────────────────────────────────────────┴──────┘
  / commands   @ entity   # tag   📎 attach     ⌘J     ← Tool chips (display only)
```

**Behavior:**
- **Auto-growing textarea:** Starts at 1 line, grows up to ~5 lines, then scrolls internally. Use a `<textarea>` with dynamic height calculation based on `scrollHeight`.
- **Enter to send:** Pressing Enter sends the message. **Shift+Enter** inserts a newline.
- **Disabled while streaming:** When the agent is actively responding, disable the input and dim the send button. Show a subtle "Agent is responding..." state.
- **Empty input:** Send button is dimmed/disabled when input is empty.

**Style (from DESIGN_SYSTEM.md §7.4):**
```tsx
const inputContainerStyle: CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)',   // 14px
  padding: '10px 14px',
  display: 'flex',
  alignItems: 'flex-end',
  gap: '8px',
};

// Focus state: border-color: var(--border-hover),
//              box-shadow: 0 0 0 3px rgba(96,184,255,0.06)

const sendButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 'var(--r-md)',   // 10px
  background: 'var(--accent)',
  color: 'var(--bg-void)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  cursor: 'pointer',
  border: 'none',
  fontSize: '14px',
  transition: 'all 150ms ease',
};

// Hover: background: var(--accent-hover), transform: scale(1.04)
// Active: transform: scale(0.96)
// Disabled: opacity: 0.4, cursor: not-allowed
```

**Tool chips** below input are display-only for v1. Render as a flex row of muted text items. No click handlers yet. They hint at future functionality:
- `/ commands` — future slash commands
- `@ entity` — future entity mention autocomplete
- `# tag` — future tag insertion
- `📎 attach` — future file attachment
- `quick ref ⌘J` — future quick reference lookup

### 5.11 ConversationTags.tsx

Inline tag display + editor popover.

**Display mode:** Renders as a flex row of tag pills in the header, each with a × remove button. Plus a "+ tag" dashed-border button at the end.

**Edit mode (popover):** Clicking "+ tag" opens a small popover (220px wide, positioned below the button):
1. Text input with placeholder "Add or create tag..."
2. As the user types, filter existing tags used in this campaign (query from conversations list — extract unique tags client-side)
3. Show matching tags as a selectable list
4. If no match, show "+ Create [typed text]" option at bottom
5. Selecting a tag adds it to the conversation's `tags` array
6. Press Escape or click outside to close

**Tag color mapping:** Hash the tag string to deterministically pick from a small palette of muted entity colors. This keeps the same tag consistently the same color.

```tsx
const TAG_COLORS = [
  { bg: 'rgba(96,184,255,0.08)', text: 'rgba(96,184,255,0.6)' },   // blue
  { bg: 'rgba(75,195,150,0.08)', text: 'rgba(75,195,150,0.6)' },   // green
  { bg: 'rgba(196,160,232,0.08)', text: 'rgba(196,160,232,0.6)' }, // purple
  { bg: 'rgba(200,170,110,0.08)', text: 'rgba(200,170,110,0.6)' }, // amber
  { bg: 'rgba(232,120,100,0.08)', text: 'rgba(232,120,100,0.6)' }, // coral
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash) + tag.charCodeAt(i);
    hash = hash & hash;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
```

### 5.12 StreamingCursor.tsx

A blinking blue cursor that appears at the end of streaming text.

```tsx
const StreamingCursor = () => (
  <span style={{
    display: 'inline-block',
    width: 2,
    height: 16,
    background: 'var(--accent)',
    verticalAlign: 'text-bottom',
    marginLeft: 1,
    animation: 'blink 1s infinite',
  }} />
);
```

Add the `@keyframes blink` rule to the global CSS or as an inline `<style>` in the component.

### 5.13 ChatEmptyState.tsx

Shown when no conversation is selected or a new conversation has no messages.

**Contents:**
1. Dragon mascot emoji (40px, 0.3 opacity)
2. Heading: "What would you like to explore?" — `var(--font-display)`, 20px, weight 600, `--text-secondary`
3. Subtext: "Ask about your campaign lore, generate NPC dialogue, plan encounters, or explore storylines." — 13px, `--text-dim`, max-width 380px
4. Starter prompt buttons — 4 pill-shaped buttons in a centered flex-wrap row:
   - "Prep next session"
   - "Recap last session"
   - "Generate NPC dialogue"
   - "What loose threads exist?"

Clicking a starter prompt inserts it into the input bar (or sends it directly — your call, but inserting into input is more forgiving since the user can edit before sending).

**Style for starter prompts:**
```tsx
const starterStyle: CSSProperties = {
  padding: '8px 14px',
  borderRadius: '10px',
  border: '0.5px solid rgba(208,228,240,0.1)',
  background: 'rgba(208,228,240,0.03)',
  fontSize: '12px',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  transition: 'all 150ms ease',
};
// Hover: border-color: var(--border-hover), color: var(--text-secondary)
```

### 5.14 ChatErrorMessage.tsx

Displayed when an agent response fails.

**Two variants:**

**Generic error** (500-level):
- Red dot (6px, `--status-danger`) in agent header position
- Error card: `rgba(232,93,80,0.06)` bg, `rgba(232,93,80,0.15)` border, `--r-lg` radius
- Text: "Something went wrong generating a response. This might be a temporary issue with the AI service."
- "↻ Try again" button: `--status-danger` color, border

**Rate limit error** (429):
- Amber dot (6px, `--status-warning`) in agent header position
- Warning card: `rgba(239,173,63,0.06)` bg, `rgba(239,173,63,0.15)` border
- Text: "The AI service is busy right now. Try again in a moment."
- "↻ Retry in Xs" button with countdown timer (use `retryAfter` from the error if available)

**Props:**
```tsx
interface ChatErrorMessageProps {
  error: TRPCClientError;
  onRetry: () => void;
}
```

Detect rate limit via `error.data?.code === 'TOO_MANY_REQUESTS'` (this is how the server maps 429s — see IMPLEMENTATION_NOTES.md).

---

## 6. Hooks

### 6.1 useChat.ts

Core hook for sending messages and managing streaming state.

```tsx
interface UseChatReturn {
  sendMessage: (query: string) => Promise<void>;
  isLoading: boolean;       // true while waiting for response
  isStreaming: boolean;      // true while tokens are arriving (future: when streaming is wired)
  streamingContent: string;  // partial content during streaming
  error: TRPCClientError | null;
  retry: () => void;         // re-send the last failed message
}
```

**Implementation approach:**

For v1 (if 3.2 delivers non-streaming mutation):
1. User sends message → add optimistic user message to local state
2. Call `trpc.conversation.chat.mutate({ campaignId, conversationId, query })`
3. Set `isLoading: true` during the call
4. On success: add agent message to local state, invalidate `getMessages` query
5. On error: set error state, keep the optimistic user message visible (so context is preserved)

For streaming (if 3.2 delivers SSE or subscription):
1. Same optimistic user message insertion
2. Open SSE connection or tRPC subscription
3. As tokens arrive, accumulate in `streamingContent`
4. Set `isStreaming: true` during token arrival
5. On stream complete: finalize agent message, invalidate queries

**Important:** The hook should work with the non-streaming mutation first and be upgradeable to streaming. Abstract the "send and receive" behind the hook interface so `MessageList` doesn't care which mode is active.

**Optimistic updates:** After sending, immediately append the user message to the displayed list without waiting for `getMessages` to refetch. On success, the refetch will return the same message (plus the agent response). On error, the optimistic message stays — the user can see what they sent and retry.

### 6.2 useConversations.ts

Manages conversation list state.

```tsx
interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  activeConversationId: string | null;
  createConversation: () => Promise<string>; // returns new conversation ID
  archiveConversation: (id: string) => void;
  updateTitle: (id: string, title: string) => Promise<void>;
  updateTags: (id: string, tags: string[]) => Promise<void>;
}
```

**Implementation:**
- `conversations`: from `trpc.conversation.list.useQuery({ campaignId })`
- `createConversation`: calls `trpc.conversation.create.mutate`, invalidates list, returns new ID for navigation
- `archiveConversation`: optimistic removal from local list + delayed mutation (5s undo window)
- `updateTitle` / `updateTags`: call the update procedure (see §8 Backend Additions)

### 6.3 useAutoScroll.ts

Scroll management for the message list.

**Behavior:**
- Auto-scroll to bottom when new messages arrive
- If user scrolls up (manually), **pause** auto-scroll — don't yank them back down
- If user scrolls back to the bottom (within ~50px of the end), **resume** auto-scroll
- Always auto-scroll on the user's own new message (they expect to see what they just sent)

```tsx
interface UseAutoScrollReturn {
  containerRef: RefObject<HTMLDivElement>;
  scrollToBottom: () => void;
  isAtBottom: boolean;
}
```

Implementation: attach a scroll listener to the container. Track whether `scrollTop + clientHeight >= scrollHeight - 50`. Use a `MutationObserver` or `useEffect` on message count to trigger scroll-to-bottom when appropriate.

---

## 7. Right Panel — Context Tab

The right panel already exists as `Panel.tsx` in the layouts. For 3.3, populate the "Context" tab with entities mentioned in the current conversation's agent responses.

### Content Sections

**Mentioned entities:** Extracted from the `sources` array of agent messages in the current conversation. Group unique entities and display as a list with:
- Entity avatar (28×28px, `--r-md`, colored background per entity type, single letter initial)
- Entity name (12px, weight 500, `--text-primary`)
- Entity type label (10px, entity type color at 0.5 opacity)

**Active threads:** Placeholder for v1. Show section header but with empty state text: "Thread tracking coming soon." This section will be populated when story arc entities are implemented.

**Recent session context:** If the conversation's source citations reference any session logs, show a brief preview of the most recent session. Style: left border (2px, `--accent`), 11px text, `--text-muted`.

### Entity Color Mapping

From DESIGN_SYSTEM.md §6, use these entity type → color mappings for avatars and type labels:

| Entity Type | Color Token | Hex |
|---|---|---|
| NPC | `--ent-npc` | #60b8ff |
| Faction | `--ent-faction` | #4bc396 |
| Location | `--ent-location` | #c8aa6e |
| Item | `--ent-item` | #e0a864 |
| Story Arc | `--ent-story-arc` | #c4a0e8 |

---

## 8. Backend Additions Required

The existing conversation router needs two additional procedures for this task:

### 8.1 conversation.update

```tsx
// In apps/server/src/routers/conversation.ts

update: procedure
  .input(z.object({
    id: z.string().uuid(),
    title: z.string().max(200).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    status: z.enum(['active', 'archived']).optional(),
  }))
  .mutation(({ ctx, input }) =>
    withErrorHandling(async () => {
      const { id, ...fields } = input;
      const updateData: Record<string, unknown> = {};
      if (fields.title !== undefined) updateData.title = fields.title;
      if (fields.tags !== undefined) updateData.tags = fields.tags;
      if (fields.status !== undefined) updateData.status = fields.status;

      if (Object.keys(updateData).length === 0) {
        const rows = await ctx.db.select().from(conversations).where(eq(conversations.id, id));
        return rows[0];
      }

      const rows = await ctx.db
        .update(conversations)
        .set(updateData)
        .where(eq(conversations.id, id))
        .returning();

      if (rows.length === 0) throw new NotFoundError('Conversation', id);
      return rows[0];
    }),
  ),
```

### 8.2 Update conversation.list to filter by status

The current `list` procedure returns all conversations. Update it to only return active conversations by default:

```tsx
list: procedure
  .input(z.object({
    campaignId: z.string().uuid(),
    status: z.enum(['active', 'archived']).default('active'),
  }))
  .query(({ ctx, input }) =>
    withErrorHandling(async () => {
      return ctx.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.campaignId, input.campaignId),
            eq(conversations.status, input.status),
          )
        )
        .orderBy(desc(conversations.updatedAt)); // most recent first
    }),
  ),
```

Note: This changes sort order from `asc` to `desc` — most recent conversations should be at the top.

---

## 9. State Management Summary

| State | Where it lives | Persistence |
|---|---|---|
| Drawer open/closed | React state + localStorage | Across page reloads |
| Panel open/closed | React state + localStorage | Across page reloads |
| Active conversation ID | URL params (`/chat/:conversationId`) | In URL (shareable) |
| Conversation list | tRPC query cache (`conversation.list`) | Server |
| Message list | tRPC query cache (`conversation.getMessages`) | Server |
| Optimistic user message | Local React state in `useChat` | Transient |
| Streaming content | Local React state in `useChat` | Transient |
| Tag editor popover open | Local React state in `ConversationTags` | Transient |
| Inline title editing | Local React state in `ChatHeader` | Transient |

---

## 10. Testing Requirements

### Component Tests

| Component | Test cases |
|---|---|
| `UserMessage` | Renders content, preserves whitespace/newlines |
| `AgentMessage` | Renders content, renders sources, renders streaming cursor when `isStreaming`, renders bold text |
| `SourceChip` | Renders correct color per source type (document/session/entity), calls onClick |
| `ChatInput` | Enter sends message, Shift+Enter adds newline, disabled when loading, send button disabled when empty |
| `ChatEmptyState` | Renders heading, subtext, and 4 starter prompts. Starter prompt click calls handler |
| `ChatErrorMessage` | Generic error renders red card with retry. Rate limit renders amber card with countdown |
| `ConversationListItem` | Renders title/timestamp/tags, active state styling, hover shows actions, archive calls handler |
| `ConversationTags` | Renders existing tags with × buttons, "+ tag" opens popover, typing filters suggestions |
| `MessageList` | Loading state shows skeleton, empty state shows `ChatEmptyState`, renders messages in order |
| `ConversationDrawer` | Renders conversation list, new button calls create handler, search filters list |

### Hook Tests

| Hook | Test cases |
|---|---|
| `useChat` | Sends message, sets loading state, handles success, handles error, retry re-sends |
| `useConversations` | Lists conversations, creates new, archives with undo, updates title, updates tags |
| `useAutoScroll` | Auto-scrolls on new message, pauses when user scrolls up, resumes at bottom |

### Integration Test

- Full flow: navigate to `/campaign/:id/chat` → create conversation → send message → receive response → response displays with sources → switch to a different conversation → messages update

---

## 11. Accessibility

- All interactive elements must be keyboard-navigable (tab order)
- Chat input: focus with ⌘/ shortcut (future, but structure the handler)
- Drawer toggle: keyboard-accessible (Enter/Space)
- Message list: `role="log"` and `aria-live="polite"` for screen readers to announce new messages
- Source chips: `role="button"`, `tabIndex={0}`, Enter/Space to activate
- Tag editor popover: Escape to close, arrow keys to navigate suggestions
- Streaming cursor: `aria-hidden="true"` (decorative)
- Focus ring: `box-shadow: 0 0 0 3px rgba(96,184,255,0.06)` on all focusable elements

---

## 12. Animation & Transitions

Per DESIGN_SYSTEM.md §9, all animations must communicate state. Respect `prefers-reduced-motion: reduce`.

| Element | Animation | Duration |
|---|---|---|
| Drawer slide in/out | `transform: translateX` | 200ms ease |
| Panel slide in/out | `transform: translateX` | 200ms ease |
| Scrim fade in/out | `opacity` | 150ms ease |
| Streaming cursor blink | `opacity: 1 → 0` | 1s infinite |
| Message appear | `opacity: 0 → 1, translateY(8px → 0)` | 200ms ease |
| Archive toast appear | `opacity: 0 → 1, translateY(8px → 0)` | 150ms ease |
| Suggested action hover lift | `translateY(-1px)` | 150ms ease |
| Send button hover scale | `scale(1.04)` | 150ms ease |
| Send button active scale | `scale(0.96)` | 50ms ease |

---

## 13. Deferred / Out of Scope

These items appear in wireframes as visual affordances but are NOT functional in 3.3:

| Feature | Shown as | Functional in |
|---|---|---|
| Command palette (⌘K) | Header trigger button | Milestone 16 |
| Entity hover cards | Colored text in agent messages | Milestone 5 |
| `/commands` autocomplete | Tool chip below input | Future |
| `@entity` mention | Tool chip below input | Future |
| `📎 attach` file upload | Tool chip below input | Future |
| `⌘J` quick reference | Tool chip below input | Milestone 7 |
| Suggested actions from agent | `SuggestedAction` component built but unused | Milestone 11+ |
| Campaign switcher dropdown | Campaign badge is display-only | Future |
| Session notes panel tab | Tab exists, content placeholder | Milestone 4 |

---

## 14. Implementation Order

Recommended build sequence for the coding agent:

1. **Backend first:** Add `conversation.update` procedure, update `conversation.list` to filter by status and sort desc. Write tests.
2. **Hooks:** `useConversations`, `useChat`, `useAutoScroll`. Write tests for each.
3. **Atomic components:** `UserMessage`, `AgentMessage`, `SourceChip`, `StreamingCursor`, `ChatErrorMessage`, `ChatEmptyState`, `ChatInput`. Write component tests.
4. **Composite components:** `MessageList`, `ConversationListItem`, `ConversationTags`.
5. **Layout components:** `ChatHeader`, `ConversationDrawer`, `ChatPage`.
6. **Integration:** Wire up routes, connect hooks to components, test full flow.
7. **Polish:** Animations, responsive behavior (tablet overlay), localStorage persistence.
