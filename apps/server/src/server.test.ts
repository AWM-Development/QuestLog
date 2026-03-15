import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";

describe("server", () => {
	it("GET /health returns 200 with status ok", async () => {
		const app = buildApp();

		const response = await app.inject({
			method: "GET",
			url: "/health",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "ok" });
	});
});
