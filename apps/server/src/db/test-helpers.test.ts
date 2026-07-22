import { afterEach, describe, expect, it, vi } from "vitest";
import { FAKE_HOSTED_DB_URL } from "./test-db-url.js";
import { createTestDb } from "./test-helpers.js";

describe("createTestDb", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("refuses a prod-shaped DATABASE_URL (hosted Neon branch) instead of connecting", () => {
		vi.stubEnv("DATABASE_URL", FAKE_HOSTED_DB_URL);

		expect(() => createTestDb()).toThrow(/non-local database host/);
	});
});
