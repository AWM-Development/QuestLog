import { describe, expect, it } from "vitest";
import {
	APPEND_ENTITY_NOTE_DESCRIPTION,
	ARCHIVE_ENTITY_DESCRIPTION,
	CONFIRM_ARCHIVE_ENTITY_DESCRIPTION,
	CONFIRM_CORRECT_LORE_DESCRIPTION,
	CONFIRM_INGEST_ENTITIES_DESCRIPTION,
	CONFIRM_LOG_SESSION_DESCRIPTION,
	CONFIRM_UNARCHIVE_ENTITY_DESCRIPTION,
	CONFIRM_UPDATE_ENTITY_DESCRIPTION,
	CORRECT_LORE_DESCRIPTION,
	CREATE_CAMPAIGN_DESCRIPTION,
	CREATE_ENTITY_DESCRIPTION,
	GET_ENTITY_DESCRIPTION,
	GET_SOURCE_STATUS_DESCRIPTION,
	HELP_DESCRIPTION,
	INGEST_TEXT_DESCRIPTION,
	LIST_CAMPAIGNS_DESCRIPTION,
	LIST_ENTITIES_DESCRIPTION,
	LOG_SESSION_DESCRIPTION,
	PREP_BRIEF_DESCRIPTION,
	QUERY_LORE_DESCRIPTION,
	UNARCHIVE_ENTITY_DESCRIPTION,
	UPDATE_ENTITY_DESCRIPTION,
} from "./tool-descriptions";

// T-101: every preview-side description for a tool with a paired confirm_*
// tool must instruct the model to narrate the proposed change to the user
// before calling confirm, per .claude/rules/mcp.md's "Agent-interaction
// philosophy" (confirmation-narration rule, T-100/G-012).
const NARRATE_BEFORE_CONFIRM =
	/(summariz|narrat|tell|explain).{0,80}(user).{0,80}(before).{0,40}(confirm)|(confirm).{0,80}(before|after).{0,80}(summariz|narrat|tell|explain).{0,80}(user)/is;

describe("tool-descriptions narrate-before-confirm language (T-101)", () => {
	it("update_entity instructs summarizing the change to the user before confirming", () => {
		expect(UPDATE_ENTITY_DESCRIPTION).toMatch(NARRATE_BEFORE_CONFIRM);
	});

	it("log_session instructs summarizing the change to the user before confirming", () => {
		expect(LOG_SESSION_DESCRIPTION).toMatch(NARRATE_BEFORE_CONFIRM);
	});

	it("correct_lore instructs summarizing the change to the user before confirming", () => {
		expect(CORRECT_LORE_DESCRIPTION).toMatch(NARRATE_BEFORE_CONFIRM);
	});

	it("preview/confirm mechanics language survives the narration additions", () => {
		expect(UPDATE_ENTITY_DESCRIPTION).toMatch(/confirm_update_entity/);
		expect(UPDATE_ENTITY_DESCRIPTION).toMatch(/token/);
		expect(LOG_SESSION_DESCRIPTION).toMatch(/confirm_log_session/);
		expect(LOG_SESSION_DESCRIPTION).toMatch(/token/);
		expect(CORRECT_LORE_DESCRIPTION).toMatch(/confirm_correct_lore/);
		expect(CORRECT_LORE_DESCRIPTION).toMatch(/token/);
	});

	it("confirm-side descriptions still describe what they apply", () => {
		expect(CONFIRM_UPDATE_ENTITY_DESCRIPTION).toMatch(/update_entity/);
		expect(CONFIRM_LOG_SESSION_DESCRIPTION).toMatch(/log_session/);
	});

	it("ingest_text (async background work) still instructs proactive status-checking", () => {
		expect(INGEST_TEXT_DESCRIPTION).toMatch(/proactively/i);
		expect(INGEST_TEXT_DESCRIPTION).toMatch(/get_source_status/);
	});
});

// T-139: every "Direct write" tool places the label immediately after the
// description's first sentence, then any further elaboration — not at the
// end. Locks in the convention across the full exported set so a future
// direct-write tool addition that drifts fails a test instead of silently
// landing.
const DIRECT_WRITE_RIGHT_AFTER_FIRST_SENTENCE = /^[^.]+\.\s+Direct write —/;

describe("tool-descriptions Direct-write label placement (T-139)", () => {
	const directWriteDescriptions: [string, string][] = [
		["CREATE_CAMPAIGN_DESCRIPTION", CREATE_CAMPAIGN_DESCRIPTION],
		["CREATE_ENTITY_DESCRIPTION", CREATE_ENTITY_DESCRIPTION],
		["APPEND_ENTITY_NOTE_DESCRIPTION", APPEND_ENTITY_NOTE_DESCRIPTION],
	];

	it.each(directWriteDescriptions)(
		"%s places 'Direct write —' immediately after the first sentence",
		(_name, description) => {
			expect(description).toMatch(DIRECT_WRITE_RIGHT_AFTER_FIRST_SENTENCE);
		},
	);
});

// T-139: every description for a tool that isn't a pure preview (i.e. every
// tool whose response the calling model actually needs to inspect
// field-by-field) ends with a "Returns ..." clause naming the returned
// shape. Preview-only tools (their own confirm_* tool is the one that
// actually persists anything) are exempt — the pattern is spelled out
// per-tool below, not inferred from the diff, so a future addition that
// drifts either way fails loudly instead of silently landing.
const ENDS_WITH_RETURNS_CLAUSE = /Returns [^.]+\.$/;

describe("tool-descriptions Returns-clause presence (T-139)", () => {
	const nonPreviewDescriptions: [string, string][] = [
		["QUERY_LORE_DESCRIPTION", QUERY_LORE_DESCRIPTION],
		["PREP_BRIEF_DESCRIPTION", PREP_BRIEF_DESCRIPTION],
		["LIST_CAMPAIGNS_DESCRIPTION", LIST_CAMPAIGNS_DESCRIPTION],
		["CREATE_CAMPAIGN_DESCRIPTION", CREATE_CAMPAIGN_DESCRIPTION],
		["LIST_ENTITIES_DESCRIPTION", LIST_ENTITIES_DESCRIPTION],
		["GET_ENTITY_DESCRIPTION", GET_ENTITY_DESCRIPTION],
		["CREATE_ENTITY_DESCRIPTION", CREATE_ENTITY_DESCRIPTION],
		["APPEND_ENTITY_NOTE_DESCRIPTION", APPEND_ENTITY_NOTE_DESCRIPTION],
		["CONFIRM_UPDATE_ENTITY_DESCRIPTION", CONFIRM_UPDATE_ENTITY_DESCRIPTION],
		["CONFIRM_ARCHIVE_ENTITY_DESCRIPTION", CONFIRM_ARCHIVE_ENTITY_DESCRIPTION],
		[
			"CONFIRM_UNARCHIVE_ENTITY_DESCRIPTION",
			CONFIRM_UNARCHIVE_ENTITY_DESCRIPTION,
		],
		["CONFIRM_LOG_SESSION_DESCRIPTION", CONFIRM_LOG_SESSION_DESCRIPTION],
		["INGEST_TEXT_DESCRIPTION", INGEST_TEXT_DESCRIPTION],
		[
			"CONFIRM_INGEST_ENTITIES_DESCRIPTION",
			CONFIRM_INGEST_ENTITIES_DESCRIPTION,
		],
		["GET_SOURCE_STATUS_DESCRIPTION", GET_SOURCE_STATUS_DESCRIPTION],
		["CONFIRM_CORRECT_LORE_DESCRIPTION", CONFIRM_CORRECT_LORE_DESCRIPTION],
		["HELP_DESCRIPTION", HELP_DESCRIPTION],
	];

	it.each(nonPreviewDescriptions)(
		"%s ends with a Returns clause naming the returned shape",
		(_name, description) => {
			expect(description).toMatch(ENDS_WITH_RETURNS_CLAUSE);
		},
	);

	const previewOnlyDescriptions: [string, string][] = [
		["UPDATE_ENTITY_DESCRIPTION", UPDATE_ENTITY_DESCRIPTION],
		["ARCHIVE_ENTITY_DESCRIPTION", ARCHIVE_ENTITY_DESCRIPTION],
		["UNARCHIVE_ENTITY_DESCRIPTION", UNARCHIVE_ENTITY_DESCRIPTION],
		["LOG_SESSION_DESCRIPTION", LOG_SESSION_DESCRIPTION],
		["CORRECT_LORE_DESCRIPTION", CORRECT_LORE_DESCRIPTION],
	];

	it.each(previewOnlyDescriptions)(
		"%s is preview-only and exempt from the Returns-clause convention",
		(_name, description) => {
			expect(description).not.toMatch(ENDS_WITH_RETURNS_CLAUSE);
		},
	);
});
