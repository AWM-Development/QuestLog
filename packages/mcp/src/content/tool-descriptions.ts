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

export const UPDATE_ENTITY_DESCRIPTION =
	"Preview a change to an existing entity's name, type, or description: returns the proposed before/after field values without persisting anything. Call confirm_update_entity with the returned token to save it.";

export const CONFIRM_UPDATE_ENTITY_DESCRIPTION =
	"Confirm a previously-previewed update_entity change-set: applies the proposed field changes to the entity.";

export const ARCHIVE_ENTITY_DESCRIPTION =
	"Preview archiving an existing entity: hides it from default listings and lookups without deleting it or marking it narratively dead. Returns the proposed status change without persisting anything. Call confirm_archive_entity with the returned token to save it.";

export const CONFIRM_ARCHIVE_ENTITY_DESCRIPTION =
	"Confirm a previously-previewed archive_entity change: sets the entity's status to archived.";

export const UNARCHIVE_ENTITY_DESCRIPTION =
	"Preview restoring a previously archived entity to active status. Returns the proposed status change without persisting anything. Call confirm_unarchive_entity with the returned token to save it.";

export const CONFIRM_UNARCHIVE_ENTITY_DESCRIPTION =
	"Confirm a previously-previewed unarchive_entity change: sets the entity's status back to active.";

export const LOG_SESSION_DESCRIPTION =
	"Preview a new session log: detects entity mentions in the content and returns the session record plus entity links that would be written, without persisting anything. Call confirm_log_session with the returned token to save it.";

export const CONFIRM_LOG_SESSION_DESCRIPTION =
	"Confirm a previously-previewed log_session change-set: creates the session record, links its confirmed entities, chunks + embeds the content, and applies entity consolidation updates, all inside a single transaction.";

export const INGEST_TEXT_DESCRIPTION =
	"Create a new knowledge-base source from text or markdown and start processing it (chunking + embedding) in the background. Returns immediately with the source's id and pending status. " +
	"Provide exactly one of campaignId (from list_campaigns, to attach to an existing campaign) or newCampaign (same shape as create_campaign's input, to spin up a new campaign in the same call) - if newCampaign is used, the response includes the created campaign's id alongside the source's. " +
	"If the user attaches a document (PDF/DOCX/image) to the conversation, extract its text yourself and call this tool directly - do not ask the user to paste it manually. " +
	"If writing out the extracted text yourself would take more than roughly a page or two of your own response, don't put it all in one call: split it across multiple calls instead, passing the first call's returned source.id as sourceId on each subsequent call and final: false until the last chunk (final: true, the default, on the last one) so processing only starts once. " +
	"After the final chunk, proactively call get_source_status to check progress and narrate it to the user. " +
	"The response also includes entityCandidates: a staged proposal of new NPCs/locations/factions/items/arcs detected in the ingested text (null if none were found). Review entityCandidates.candidates with the user and, if they want them created, call confirm_ingest_entities with entityCandidates.token.";

export const CONFIRM_INGEST_ENTITIES_DESCRIPTION =
	"Confirm a staged entityCandidates proposal from ingest_text: creates one entity per candidate. Pass candidateIndices (the 0-based positions of the candidates array returned by ingest_text) to create only a subset - omit it to create every staged candidate. Returns the created entity ids.";

export const GET_SOURCE_STATUS_DESCRIPTION =
	"Check the processing status of a source created via ingest_text (or file upload): pending, extracting, chunking, embedding, done, or error.";

export const CORRECT_LORE_DESCRIPTION =
	"Preview a lore correction: given correction text plus exactly one of sourceId (all that source's non-superseded chunks), chunkIds (explicit targets), or entityId (attribution only — empty target set, a pure addition). Returns a token and preview payload without marking anything superseded. Call confirm_correct_lore (separate tool) with the token to apply.";

export const CONFIRM_CORRECT_LORE_DESCRIPTION =
	"Confirm a previously-previewed correct_lore change-set: chunks + embeds the correction as new authoritative content and marks every target chunk superseded, all inside a single transaction.";

export const HELP_DESCRIPTION =
	"Returns a summary of QuestLog's workflow: uploading campaign documents, tracking sessions, and querying lore. Call this if you're unsure where to start.";
