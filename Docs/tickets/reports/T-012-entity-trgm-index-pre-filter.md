# T-012 — Switch entity fuzzy-name pre-filter to the indexable pg_trgm operator form

**Outcome:** won't-fix
**Investigation branch:** `claude/admiring-heisenberg-sl43m8` (never merged — no code changed, investigation-only)
**Diff:** none — no application code touched

## What was investigated

The ticket asked for the `word_similarity(name, query) > 0.15` pre-filter
shared by `detectSpans` and `getByName` (`apps/server/src/services/entity.service.ts`)
to be rewritten as an indexable `%>`/`<%` operator, so it could reach
`entities_name_trgm_idx` via a `Bitmap Index Scan` instead of a `Seq Scan`,
with an explicit exit condition that match/no-match outcomes stay identical
to today's.

## Finding

No such rewrite exists. Confirmed via `pg_opclass`/`pg_amop` and `EXPLAIN`
against a 5,001-row seeded `entities` table (scratch campaign, rolled back
after) on PostgreSQL 16.13 + pg_trgm 1.6:

- `gin_trgm_ops` only indexes the operator form `name %> query` (indexed
  column on the left). `<%` isn't a member of the opclass at all; no
  syntactic rearrangement makes the original argument order indexable —
  confirmed by forcing `enable_seqscan = off` and observing Postgres fall
  back to an absurd-cost Seq Scan rather than finding an index path.
- The one indexable form computes `word_similarity(query, name)` — the
  reverse of the original `word_similarity(name, query)`. `word_similarity`
  is documented as non-symmetric (short string first, long string second).
  `detectSpans` already calls it in that correct orientation (short entity
  `name`, long session-log `text` as `query`) — reversing it for
  indexability breaks that design assumption.
- Measured impact: a verbatim "Strahd" match embedded in a realistic
  ~1.9KB session-log-length text scores `word_similarity('Strahd', text) = 1.0`
  (today's orientation) vs. `word_similarity(text, 'Strahd') = 0.029`
  (the reversed, indexable orientation) — well under the `0.15` pre-filter
  threshold. The indexable rewrite would silently drop real entity mentions
  from `detectSpans`'s candidate set on any long text, not as an edge case.

Full EXPLAIN output and every approach attempted (including the option of
un-sharing `getByName`'s and `detectSpans`' now-consolidated (T-011) helper
so only `getByName` — which compares two short strings and is far less
exposed — gets the indexable form) are preserved in the investigation
branch's blocked report, which was not merged since this ticket resolved as
won't-fix rather than being unblocked and re-queued.

## Decision (Alex, 2026-07-16)

Don't pursue any operator-form rewrite of `word_similarity`. Two reasons:

1. **Per-campaign entity count doesn't scale with user count.** This app's
   `entities` rows per campaign are bounded by how much one DM tracks in
   one campaign (dozens to low hundreds of NPCs/locations/items), not by
   how many users or campaigns exist. The scenario where the trgm GIN index
   would matter — a single campaign with thousands of entities — is
   unrealistic for this domain.
2. **The actual scaling gap is upstream of this ticket.** `entities` (and
   every other campaign-scoped table) has no index on `campaign_id` at all
   — confirmed by grepping every `index()` declaration in
   `apps/server/src/db/schema/tables.ts`: only `entities_name_trgm_idx`
   exists. Every `WHERE campaign_id = X` query in the app, not just
   `detectSpans`/`getByName`, currently Seq Scans the *entire* table for
   that column. That gap will matter well before per-campaign entity count
   does, especially once multi-user support (a planned future milestone)
   multiplies total row counts across many campaigns.

Adding `campaign_id` btree indexes (`T-014`, opened in this same session)
addresses the actual bottleneck without touching `word_similarity`
semantics: once a query narrows to one campaign's small row set via an
indexed `campaign_id` lookup, the existing function-call `word_similarity`
filter runs cheaply over that narrowed set, and the risky operator-order
question this ticket ran into becomes moot.

## Documentation updated

- `Docs/tickets/done/T-012-entity-trgm-index-pre-filter.md` — moved from
  `backlog/`, title suffixed `— WON'T FIX`, resolution appended.
- `Docs/IMPLEMENTATION_NOTES.md` — new entry documenting the
  `word_similarity` asymmetry / GIN indexability gotcha, so a future ticket
  doesn't rediscover it from scratch.
- `Docs/tickets/queue/T-014-campaign-scoped-btree-indexes.md` — new ticket,
  the follow-up this investigation recommended.
- No `CHANGELOG.md` entry — no application code changed; the "every merged
  ticket PR adds a CHANGELOG entry" obligation applies to shipped behavior,
  and there is none here. `T-014` will add its own entry when it ships.

## Anything Alex must decide

Already decided above (this report documents that decision, not an open
question) — no `🧠` strategy gates otherwise encountered.
