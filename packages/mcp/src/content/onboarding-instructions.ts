/**
 * Shared by `createMcpServer`'s `instructions` option (surfaced automatically
 * by well-behaved clients at connect time) and the `help` tool (for a client
 * that doesn't surface `instructions`, or a mid-conversation refresher) — one
 * text source so the two can't drift apart.
 */
export const ONBOARDING_INSTRUCTIONS = `QuestLog helps you manage a tabletop RPG campaign: upload campaign documents, track sessions as you play, and query campaign lore.

Start with \`list_campaigns\` to find the campaign's id — every other tool needs it. If the user doesn't have one yet, use \`create_campaign\` to start one. From there:
- \`ingest_text\` to upload campaign documents (primers, notes, session recaps) so \`query_lore\` can search them - pass \`campaignId\` (from \`list_campaigns\`) to attach to an existing campaign, or \`newCampaign\` to spin one up inline in the same call. If the user attaches a document to the conversation, extract its text yourself and call \`ingest_text\` directly rather than asking them to paste it. If writing out the extracted text yourself would take more than roughly a page or two of your own response, don't put it all in one call — split it across multiple calls using \`sourceId\`/\`final\` instead. After ingesting, proactively call \`get_source_status\` to check progress and let the user know when it's done — ingestion may surface new NPC/location/faction/item/arc candidates it detected in the text, which you confirm into real entities with \`confirm_ingest_entities\`.
- \`log_session\` (then \`confirm_log_session\`) to track a session as it happens — this links mentioned entities and keeps campaign lore up to date.
- \`create_entity\` and \`append_entity_note\` to author NPCs, locations, factions, items, and arcs directly. \`update_entity\` (then \`confirm_update_entity\`) to rename one, replace its description, or change its type. \`archive_entity\` (then \`confirm_archive_entity\`) to retire one that's no longer active; \`unarchive_entity\` (then \`confirm_unarchive_entity\`) to bring it back.
- \`correct_lore\` (then \`confirm_correct_lore\`) to fix a mistake in ingested lore — supersedes the wrong chunks with corrected text instead of leaving contradictory canon in place. \`get_chunk_history\` is an audit-only lookup of what a chunk used to say before a correction superseded it — call it only when the user explicitly asks.
- \`add_item\`, \`transfer_item\`, and \`adjust_wealth\` for fast in-session inventory/wealth bookkeeping — direct writes, no preview/confirm step. \`list_inventory\` to look up a campaign's items and wealth.
- \`encounter\` for stateless combat utility during a fight — \`roll_initiative\` to sort already-decided initiative values, \`apply_hp_delta\` to apply clamped damage/healing and get back a healthy/bloodied/down status. No persisted encounter state; track the fight itself in conversation.
- \`query_lore\`, \`get_entity\`, \`list_entities\`, \`list_sources\`, and \`prep_brief\` to look things up during play or prep.

If a tool call returns an error, translate its \`{ error: { code, message } }\` result into a plain, non-alarming explanation with a suggested next step — don't relay the raw JSON to the user.`;
