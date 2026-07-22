import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { testDbUrl } from "./src/db/test-db-url.js";

export default defineConfig({
	schema: "./src/db/schema/tables.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? testDbUrl("questlog"),
	},
});
