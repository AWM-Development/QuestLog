import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./test-helpers.js";

describe("createTestDb", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("refuses a prod-shaped DATABASE_URL (hosted Neon branch) instead of connecting", () => {
		vi.stubEnv(
			"DATABASE_URL",
			"postgresql://user:secretpw@ep-cool-glade-12345.us-east-2.aws.neon.tech/questlog?sslmode=require",
		);

		expect(() => createTestDb()).toThrow(/non-local database host/);
	});
});
