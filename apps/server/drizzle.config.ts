import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { testDbUrl } from "../../packages/core/src/db/test-db-url.js";

export default defineConfig({
	schema: "../../packages/core/src/db/schema/tables.ts",
	out: "../../packages/core/src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? testDbUrl("questlog"),
	},
});
