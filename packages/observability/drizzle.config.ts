import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Same esbuild-register cross-package-import limitation noted in
// apps/server/drizzle.config.ts applies here — inline fallback, kept in sync
// with `../core/src/db/test-db-url.ts`'s `testDbUrl("questlog_observability")`
// output.
const FALLBACK_DATABASE_URL =
	"postgresql://questlog:questlog@localhost:5433/questlog_observability";

// Provisioning the actual Neon branch and setting `OBSERVABILITY_DATABASE_URL`
// in the deployment environment is a manual step Alex performs once, outside
// this ticket's automated scope (per G-003's resolution: separate Neon
// branch, same project, own schema/migrations independent of
// packages/core/src/db/schema/tables.ts).
export default defineConfig({
	schema: "./src/schema/tables.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.OBSERVABILITY_DATABASE_URL ?? FALLBACK_DATABASE_URL,
	},
});
