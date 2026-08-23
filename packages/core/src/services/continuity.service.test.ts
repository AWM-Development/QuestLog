import { sql } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createTestDb } from "../db/test-helpers.js";
import { campaignService } from "./campaign.service.js";
import {
	CONTRADICTION_CONFIDENCE_THRESHOLD,
	continuityService,
} from "./continuity.service.js";
import type { LlmService } from "./llm.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

/** Mock structured-extraction client — decouples detectContradictions tests from the real Anthropic API (mirrors entity.service.test.ts's createMockLlmService). */
function createMockLlmService(
	contradictions: Array<{
		entityId: string;
		newClaimExcerpt: string;
		existingClaimExcerpt: string;
		confidence: number;
	}>,
): Pick<LlmService, "callClaudeStructured"> {
	return {
		callClaudeStructured: vi.fn().mockResolvedValue({
			data: { contradictions },
			usage: { inputTokens: 0, outputTokens: 0 },
		}),
	};
}

async function insertEntity(
	campaignId: string,
	name: string,
	description: string,
	type = "npc",
): Promise<{ id: string }> {
	const rows = await db.execute(sql`
      INSERT INTO entities (campaign_id, name, type, description)
      VALUES (${campaignId}, ${name}, ${type}, ${description})
      RETURNING id
    `);
	return rows[0] as { id: string };
}

describe("continuityService.detectContradictions", () => {
	let campaignId: string;

	beforeEach(async () => {
		await db.execute(sql`BEGIN`);
		const campaign = await campaignService.create(db, {
			name: "Test Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
	});

	afterEach(async () => {
		await db.execute(sql`ROLLBACK`);
	});

	it("returns a contradiction candidate for an entity whose new claim conflicts with its existing lore", async () => {
		const entity = await insertEntity(
			campaignId,
			"Lord Varen",
			"Lord Varen is deceased, killed at the Siege of Korth",
		);
		const text = "Lord Varen greeted the party at the gate.";
		const llmService = createMockLlmService([
			{
				entityId: entity.id,
				newClaimExcerpt: "Lord Varen greeted the party at the gate.",
				existingClaimExcerpt:
					"Lord Varen is deceased, killed at the Siege of Korth",
				confidence: 0.9,
			},
		]);

		const candidates = await continuityService.detectContradictions(db, {
			campaignId,
			text,
			llmService,
		});

		expect(candidates).toEqual([
			{
				entityId: entity.id,
				entityName: "Lord Varen",
				newClaimExcerpt: "Lord Varen greeted the party at the gate.",
				existingClaimExcerpt:
					"Lord Varen is deceased, killed at the Siege of Korth",
				confidence: 0.9,
			},
		]);
		expect(llmService.callClaudeStructured).toHaveBeenCalledTimes(1);
	});

	it("returns an empty array when the new text doesn't contradict any existing entity lore", async () => {
		const entity = await insertEntity(
			campaignId,
			"Lord Varen",
			"Lord Varen rules from his keep in the north.",
		);
		const text = "Lord Varen greeted the party at the gate.";
		const llmService = createMockLlmService([]);

		const candidates = await continuityService.detectContradictions(db, {
			campaignId,
			text,
			llmService,
		});

		expect(candidates).toEqual([]);
		expect(llmService.callClaudeStructured).toHaveBeenCalledTimes(1);
		void entity;
	});

	it("filters out a candidate whose confidence is below the threshold", async () => {
		const entity = await insertEntity(
			campaignId,
			"Lord Varen",
			"Lord Varen is deceased, killed at the Siege of Korth",
		);
		const text = "Lord Varen greeted the party at the gate.";
		const llmService = createMockLlmService([
			{
				entityId: entity.id,
				newClaimExcerpt: "Lord Varen greeted the party at the gate.",
				existingClaimExcerpt:
					"Lord Varen is deceased, killed at the Siege of Korth",
				confidence: CONTRADICTION_CONFIDENCE_THRESHOLD - 0.1,
			},
		]);

		const candidates = await continuityService.detectContradictions(db, {
			campaignId,
			text,
			llmService,
		});

		expect(candidates).toEqual([]);
	});

	it("returns an empty array and never calls the LLM when no known entity is mentioned in the text", async () => {
		const llmService = createMockLlmService([]);

		const candidates = await continuityService.detectContradictions(db, {
			campaignId,
			text: "An unrelated stranger passed through the village.",
			llmService,
		});

		expect(candidates).toEqual([]);
		expect(llmService.callClaudeStructured).not.toHaveBeenCalled();
	});

	it("returns an empty array for blank text", async () => {
		const llmService = createMockLlmService([]);

		const candidates = await continuityService.detectContradictions(db, {
			campaignId,
			text: "   ",
			llmService,
		});

		expect(candidates).toEqual([]);
		expect(llmService.callClaudeStructured).not.toHaveBeenCalled();
	});
});
