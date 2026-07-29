/**
 * Shared by `createMcpServer`'s `instructions` option (surfaced automatically
 * by well-behaved clients at connect time) and the `help` tool (for a client
 * that doesn't surface `instructions`, or a mid-conversation refresher) — one
 * text source so the two can't drift apart.
 */
export const ONBOARDING_INSTRUCTIONS = `QuestLog helps you manage a tabletop RPG campaign: upload campaign documents, track sessions as you play, and query campaign lore.

Start with \`list_campaigns\` to find the campaign's id — every other tool needs it. If the user doesn't have one yet, use \`create_campaign\` to start one. From there:
- \`ingest_text\` to upload campaign documents (primers, notes, session recaps) so \`query_lore\` can search them.
- \`log_session\` (then \`confirm_log_session\`) to track a session as it happens — this links mentioned entities and keeps campaign lore up to date.
- \`create_entity\` and \`append_entity_note\` to author NPCs, locations, factions, items, and arcs directly.
- \`query_lore\`, \`get_entity\`, \`list_entities\`, and \`prep_brief\` to look things up during play or prep.`;
