import { describe, expect, it } from "vitest";
import { basisVector } from "@questlog/core/db/test-helpers.js";
import { connectedClient, createMockFetch } from "../test-helpers.js";

describe("server instructions + help tool (T-033)", () => {
	it("initialize response includes onboarding instructions mentioning list_campaigns, ingest_text, and session tracking", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));

		const instructions = client.getInstructions();

		expect(instructions).toBeTruthy();
		expect(instructions).toContain("list_campaigns");
		expect(instructions).toContain("ingest_text");
		expect(instructions).toMatch(/session/i);
	});

	it("help tool returns the same onboarding text as the server instructions", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const instructions = client.getInstructions();

		const result = await client.callTool({ name: "help", arguments: {} });

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content[0]?.text).toBe(instructions);
	});

	it("onboarding instructions and ingest_text's description both cover attachment extraction and status-polling guidance (T-065)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const instructions = client.getInstructions() ?? "";

		expect(instructions).toMatch(/extract its text/i);
		expect(instructions).toMatch(/get_source_status/);

		const { tools } = await client.listTools();
		const ingestText = tools.find((tool) => tool.name === "ingest_text");
		expect(ingestText?.description).toMatch(/extract its text/i);
		expect(ingestText?.description).toMatch(/get_source_status/);
		expect(ingestText?.description).toMatch(/sourceId/);
	});

	it("onboarding instructions include error-tone guidance for translating tool errors (T-100)", async () => {
		const client = await connectedClient(createMockFetch(basisVector(0)));
		const instructions = client.getInstructions() ?? "";

		expect(instructions).toMatch(/error/i);
		expect(instructions).toMatch(/plain|non-alarming/i);
	});
});
