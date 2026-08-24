import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { registerEncounter } from "./encounter.js";

/**
 * `encounter` is the one tool in this codebase with no `db`/`storage`/
 * `llmService` dependency (pure computation, no persisted state — see the
 * ticket's "Relevant background") — connect it standalone rather than via
 * `server.test.ts`'s `connectedClient` helper, which always constructs a
 * full `ToolDeps`. This doubles as the exit condition's explicit check that
 * registration succeeds with no `ToolDeps` at all.
 */
async function connectedClient() {
	const server = new McpServer({ name: "test-server", version: "0.0.0" });
	registerEncounter(server);
	const client = new Client({ name: "test-client", version: "0.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	await Promise.all([
		client.connect(clientTransport),
		server.connect(serverTransport),
	]);
	return client;
}

describe("encounter tool", () => {
	describe("roll_initiative", () => {
		it("sorts combatants descending by initiative, tie broken by input order", async () => {
			const client = await connectedClient();

			const result = await client.callTool({
				name: "encounter",
				arguments: {
					action: "roll_initiative",
					combatants: [
						{
							name: "Goblin A",
							initiative: 12,
							hp: { current: 7, max: 7 },
							status: [],
						},
						{
							name: "Aria",
							initiative: 18,
							hp: { current: 20, max: 20 },
							status: [],
						},
						{
							name: "Goblin B",
							initiative: 12,
							hp: { current: 7, max: 7 },
							status: [],
						},
					],
				},
			});

			expect(result.isError).toBeFalsy();
			const content = result.content as Array<{ type: string; text: string }>;
			const payload = JSON.parse(content[0]?.text ?? "{}");
			expect(payload.combatants.map((c: { name: string }) => c.name)).toEqual([
				"Aria",
				"Goblin A",
				"Goblin B",
			]);
		});
	});

	describe("apply_hp_delta", () => {
		it("returns healthy when newHp stays above 50% of max", async () => {
			const client = await connectedClient();
			const result = await client.callTool({
				name: "encounter",
				arguments: {
					action: "apply_hp_delta",
					current: 20,
					max: 20,
					delta: -5,
				},
			});

			expect(result.isError).toBeFalsy();
			const content = result.content as Array<{ type: string; text: string }>;
			const payload = JSON.parse(content[0]?.text ?? "{}");
			expect(payload).toEqual({ newHp: 15, status: "healthy" });
		});

		it("returns bloodied at exactly 50% of max", async () => {
			const client = await connectedClient();
			const result = await client.callTool({
				name: "encounter",
				arguments: {
					action: "apply_hp_delta",
					current: 20,
					max: 20,
					delta: -10,
				},
			});

			expect(result.isError).toBeFalsy();
			const content = result.content as Array<{ type: string; text: string }>;
			const payload = JSON.parse(content[0]?.text ?? "{}");
			expect(payload).toEqual({ newHp: 10, status: "bloodied" });
		});

		it("clamps below-zero damage to 0 and returns down", async () => {
			const client = await connectedClient();
			const result = await client.callTool({
				name: "encounter",
				arguments: {
					action: "apply_hp_delta",
					current: 5,
					max: 20,
					delta: -30,
				},
			});

			expect(result.isError).toBeFalsy();
			const content = result.content as Array<{ type: string; text: string }>;
			const payload = JSON.parse(content[0]?.text ?? "{}");
			expect(payload).toEqual({ newHp: 0, status: "down" });
		});

		it("clamps healing above max down to max", async () => {
			const client = await connectedClient();
			const result = await client.callTool({
				name: "encounter",
				arguments: {
					action: "apply_hp_delta",
					current: 18,
					max: 20,
					delta: 50,
				},
			});

			expect(result.isError).toBeFalsy();
			const content = result.content as Array<{ type: string; text: string }>;
			const payload = JSON.parse(content[0]?.text ?? "{}");
			expect(payload).toEqual({ newHp: 20, status: "healthy" });
		});
	});
});
