import { createTestDb } from "@questlog/core/db/test-helpers.js";
import type { TicketCard } from "@questlog/core/services/board.service.js";
import { createMemoryStorage } from "@questlog/core/services/storage.service.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Mocked, not real GitHub — the router is deliberately thin (no business
// logic — see backend.md), so mocking the service layer here only exercises
// wiring: that board.list calls through and returns the service's result
// untouched. The parsing/caching logic itself is covered against fixtures
// in packages/core/src/services/board.service.test.ts, same split as
// observability.test.ts's own note on why it mocks its service layer.
vi.mock("@questlog/core/services/board.service.js", () => ({
	boardService: { list: vi.fn() },
}));

const { boardService } = await import(
	"@questlog/core/services/board.service.js"
);
const { buildApp } = await import("../server.js");

const { db, close } = createTestDb();
const storage = createMemoryStorage();
const app = buildApp({ db, storage });

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
	await close();
});

async function trpcQuery(path: string) {
	return app.inject({
		method: "GET",
		url: `/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: undefined }))}`,
	});
}

describe("board router", () => {
	describe("board.list", () => {
		it("returns the board service's cards untouched", async () => {
			const fixture: TicketCard[] = [
				{
					id: "T-100",
					title: "Example",
					priority: "P1",
					complexityTier: "S",
					blockedOn: null,
					gatedOn: null,
					status: "queue",
					path: "Docs/tickets/queue/T-100-example.md",
				},
			];
			vi.mocked(boardService.list).mockResolvedValue(fixture);

			const response = await trpcQuery("board.list");

			expect(response.statusCode).toBe(200);
			expect(boardService.list).toHaveBeenCalled();
			expect(response.json().result.data.json).toEqual(fixture);
		});
	});
});
