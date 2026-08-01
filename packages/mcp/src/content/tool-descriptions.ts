export const QUERY_LORE_DESCRIPTION =
	"Query campaign lore via hybrid vector + keyword search, returning assembled context with source citations and a confidence score.";

export const PREP_BRIEF_DESCRIPTION =
	"Assemble a session prep brief for a campaign: a recap of recent sessions, active plot threads, likely NPCs, and quick links.";

export const LIST_CAMPAIGNS_DESCRIPTION =
	"List all campaigns, returning each campaign's id, name, description, theme, gameSystem, and status. Call this first when the user hasn't supplied a campaignId, so you can identify theirs and use its id in subsequent tool calls.";

export const CREATE_CAMPAIGN_DESCRIPTION =
	"Create a new campaign. Direct write — only ever inserts a new row, no preview/confirm needed. Returns the created campaign's id, name, description, theme, gameSystem, and status.";

export const LIST_ENTITIES_DESCRIPTION =
	"List entities in a campaign, optionally filtered by type (npc, location, faction, item, arc).";

export const GET_ENTITY_DESCRIPTION =
	"Look up a single entity by id or by fuzzy name match. Exactly one of entityId or name must be provided.";

export const CREATE_ENTITY_DESCRIPTION =
	"Create a new entity (npc, location, faction, item, or arc) in a campaign. Direct write — only ever inserts a new row, no preview/confirm needed.";

export const APPEND_ENTITY_NOTE_DESCRIPTION =
	"Append a note to an existing entity's description, without overwriting its prior content. Direct write — additive only, no preview/confirm needed.";

export const LOG_SESSION_DESCRIPTION =
	"Preview a new session log: detects entity mentions in the content and returns the session record plus entity links that would be written, without persisting anything. Call confirm_log_session with the returned token to save it.";

export const CONFIRM_LOG_SESSION_DESCRIPTION =
	"Confirm a previously-previewed log_session change-set: creates the session record, links its confirmed entities, chunks + embeds the content, and applies entity consolidation updates, all inside a single transaction.";

export const INGEST_TEXT_DESCRIPTION =
	"Create a new knowledge-base source from text or markdown and start processing it (chunking + embedding) in the background. Returns immediately with the source's id and pending status. " +
	"If the user attaches a document (PDF/DOCX/image) to the conversation, extract its text yourself and call this tool directly - do not ask the user to paste it manually. " +
	"If writing out the extracted text yourself would take more than roughly a page or two of your own response, don't put it all in one call: split it across multiple calls instead, passing the first call's returned source.id as sourceId on each subsequent call and final: false until the last chunk (final: true, the default, on the last one) so processing only starts once. " +
	"After the final chunk, proactively call get_source_status to check progress and narrate it to the user.";

export const GET_SOURCE_STATUS_DESCRIPTION =
	"Check the processing status of a source created via ingest_text (or file upload): pending, extracting, chunking, embedding, done, or error.";

export const HELP_DESCRIPTION =
	"Returns a summary of QuestLog's workflow: uploading campaign documents, tracking sessions, and querying lore. Call this if you're unsure where to start.";
