import { entities } from "@questlog/core/db/schema/index.js";
import {
	basisVector,
	deleteCampaignTree,
} from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import type { LlmService } from "@questlog/core/services/llm.service.js";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";

/** Mock structured-extraction client returning a fixed creature list (mocks are the default per .claude/rules/backend.md). */
function createCreatureLlmService(
	creatures: Array<{ creatureName: string; count: number }>,
): Pick<LlmService, "callClaudeStructured"> {
	return {
		callClaudeStructured: vi.fn().mockResolvedValue({
			data: { creatures },
			usage: { inputTokens: 0, outputTokens: 0 },
		}),
	};
}

function parse(result: unknown) {
	const content = (result as { content: Array<{ text: string }> }).content;
	return JSON.parse(content[0]?.text ?? "{}");
}

// confirm opens its own db.transaction() — explicit FK-safe cleanup instead of
// the raw BEGIN/ROLLBACK wrapper (.claude/rules/backend.md "Test DB pattern").
describe("generate_encounter / confirm_generate_encounter tools (T-174)", () => {
	let campaignId: string;
	let goblinId: string;

	beforeEach(async () => {
		const campaign = await campaignService.create(db, {
			name: "Ashfall Primer Campaign",
			theme: "fantasy",
		});
		campaignId = campaign.id;
		const goblin = await entityService.create(db, {
			campaignId,
			name: "Goblin",
			type: "monster",
		});
		goblinId = goblin.id;
	});

	afterEach(async () => {
		await deleteCampaignTree(db, campaignId);
	});

	const creatures = [
		{ creatureName: "Goblin", count: 3 },
		{ creatureName: "Bugbear Chieftain", count: 1 },
	];

	async function preview(
		llmService = createCreatureLlmService(creatures),
		extra: Record<string, unknown> = {},
	) {
		const client = await connectedClient(
			createMockFetch(basisVector(0)),
			llmService,
		);
		const result = await client.callTool({
			name: "generate_encounter",
			arguments: {
				campaignId,
				name: "Bridge ambush",
				description: "Three goblins and a bugbear chieftain hold the bridge",
				...extra,
			},
		});
		return { client, result };
	}

	it("splits extracted creatures into roster matches and new-monster candidates", async () => {
		const { result } = await preview();

		expect(result.isError).toBeFalsy();
		const { token, preview: payload } = parse(result);
		expect(token).toEqual(expect.any(String));
		expect(payload.matched).toEqual([
			{ entityId: goblinId, name: "Goblin", type: "monster", count: 3 },
		]);
		expect(payload.newMonsterCandidates).toEqual([
			{ name: "Bugbear Chieftain", count: 1 },
		]);
	});

	it("persists nothing at preview time", async () => {
		await preview();

		const monsters = await db
			.select()
			.from(entities)
			.where(
				and(eq(entities.campaignId, campaignId), eq(entities.type, "monster")),
			);
		expect(monsters).toHaveLength(1);
		const listed = parse(
			await (await connectedClient(createMockFetch(basisVector(0)))).callTool({
				name: "list_encounters",
				arguments: { campaignId },
			}),
		);
		expect(listed).toHaveLength(0);
	});

	it("does not match a non-monster entity with the same name", async () => {
		await entityService.create(db, {
			campaignId,
			name: "Bugbear Chieftain",
			type: "npc",
		});

		const { result } = await preview();

		expect(parse(result).preview.newMonsterCandidates).toEqual([
			{ name: "Bugbear Chieftain", count: 1 },
		]);
	});

	it("merges repeated creatures into one entry and sums their counts", async () => {
		const { result } = await preview(
			createCreatureLlmService([
				{ creatureName: "Goblin", count: 2 },
				{ creatureName: "goblin", count: 1 },
				{ creatureName: "Ogre", count: 1 },
				{ creatureName: "Ogre", count: 1 },
			]),
		);

		const { preview: payload } = parse(result);
		expect(payload.matched).toEqual([
			{ entityId: goblinId, name: "Goblin", type: "monster", count: 3 },
		]);
		expect(payload.newMonsterCandidates).toEqual([{ name: "Ogre", count: 2 }]);
	});

	it("confirm creates the new monsters and saves a retrievable encounter", async () => {
		const { client, result } = await preview(undefined, {
			notes: "Rope bridge, fog",
		});
		const { token } = parse(result);

		const confirmed = await client.callTool({
			name: "confirm_generate_encounter",
			arguments: { token },
		});
		expect(confirmed.isError).toBeFalsy();
		const encounter = parse(confirmed);

		const monsters = await db
			.select()
			.from(entities)
			.where(
				and(eq(entities.campaignId, campaignId), eq(entities.type, "monster")),
			);
		expect(monsters.map((m) => m.name).sort()).toEqual([
			"Bugbear Chieftain",
			"Goblin",
		]);
		const bugbear = monsters.find((m) => m.name === "Bugbear Chieftain");

		const fetched = parse(
			await client.callTool({
				name: "get_encounter",
				arguments: { campaignId, encounterId: encounter.id },
			}),
		);
		expect(fetched.name).toBe("Bridge ambush");
		expect(fetched.notes).toBe("Rope bridge, fog");
		// Both member rows share the confirm transaction's timestamp, so row order is unspecified.
		expect(fetched.members).toHaveLength(2);
		expect(fetched.members).toEqual(
			expect.arrayContaining([
				{ entityId: goblinId, name: "Goblin", type: "monster", count: 3 },
				{
					entityId: bugbear?.id,
					name: "Bugbear Chieftain",
					type: "monster",
					count: 1,
				},
			]),
		);
	});

	it("rejects a second confirm of the same token", async () => {
		const { client, result } = await preview();
		const { token } = parse(result);
		await client.callTool({
			name: "confirm_generate_encounter",
			arguments: { token },
		});

		const again = await client.callTool({
			name: "confirm_generate_encounter",
			arguments: { token },
		});
		expect(again.isError).toBe(true);
	});
});
