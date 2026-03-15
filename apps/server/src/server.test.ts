import { afterAll, describe, expect, it } from "vitest";
import { createTestDb } from "./db/test-helpers.js";
import { buildApp } from "./server.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

describe("server", () => {
	it("GET /health returns 200 with status ok", async () => {
		const app = buildApp({ db });

		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "ok" });
	});
});
