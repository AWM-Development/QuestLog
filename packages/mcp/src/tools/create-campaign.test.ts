import { afterEach, describe, expect, it } from "vitest";
import { basisVector } from "@questlog/core/db/test-helpers.js";
import { campaigns } from "@questlog/core/db/schema/index.js";
import { connectedClient, createMockFetch, db } from "../test-helpers.js";
import { eq } from "drizzle-orm";

describe("create_campaign tool", () => {
	let campaignId: string | undefined;

	afterEach(async () => {
		if (campaignId) {
			await db.delete(campaigns).where(eq(campaigns.id, campaignId));
		}
	});

	it("creates a row immediately visible via list_campaigns", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const createResult = await client.callTool({
			name: "create_campaign",
			arguments: {
				name: "Ashfall Primer Campaign",
				description: "A frontier town beset by ash storms.",
				theme: "fantasy",
				gameSystem: "D&D 5e",
			},
		});

		expect(createResult.isError).toBeFalsy();
		const createContent = createResult.content as Array<{
			type: string;
			text: string;
		}>;
		const created = JSON.parse(createContent[0]?.text ?? "{}");
		campaignId = created.id;
		expect(created.id).toBeDefined();
		expect(created).toMatchObject({
			name: "Ashfall Primer Campaign",
			description: "A frontier town beset by ash storms.",
			theme: "fantasy",
			gameSystem: "D&D 5e",
			status: "active",
		});

		const listResult = await client.callTool({
			name: "list_campaigns",
			arguments: {},
		});
		expect(listResult.isError).toBeFalsy();
		const listContent = listResult.content as Array<{
			type: string;
			text: string;
		}>;
		const listed = JSON.parse(listContent[0]?.text ?? "{}");
		expect(listed.campaigns).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: created.id })]),
		);
	});

	it("rejects an invalid theme before it reaches the service", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const result = await client.callTool({
			name: "create_campaign",
			arguments: { name: "Ashfall Primer Campaign", theme: "cyberpunk" },
		});

		expect(result.isError).toBe(true);

		const rows = await db
			.select()
			.from(campaigns)
			.where(eq(campaigns.name, "Ashfall Primer Campaign"));
		expect(rows).toHaveLength(0);
	});
});
