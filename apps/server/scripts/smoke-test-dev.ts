import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@questlog/core/db/index.js";
import {
	REQUIRED_EXTENSIONS,
	migrationsFolder,
} from "@questlog/core/db/migrate.js";
import * as schema from "@questlog/core/db/schema/index.js";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { is, sql } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import superjson from "superjson";
import type { AppRouter } from "../src/routers/_app.js";

// T-036: post-merge confidence check against the real deployed dev
// environment (questlog-dev.fly.dev + its real Neon dev branch), not the
// ephemeral local Postgres ci.yml's PR gate uses. /health -> a real
// campaign.create -> campaign.list round trip through the live tRPC API,
// then a direct Postgres connection (bypassing the app entirely, per
// Docs/tickets/reports/T-025-executor-dev-only-guardrails-prod-clean-start.md)
// to confirm the schema and pgvector/pg_trgm extensions are actually present
// on the real database, not just that migrate.ts ran without error.
//
// Deliberately does NOT go through createTestDb()/global-setup.ts — both
// reject any non-local DATABASE_URL by design (packages/core/src/db/test-db-url.ts),
// and this script's whole point is to talk to a real hosted database.

// Derived from the schema barrel/migrate.ts rather than hand-copied — a
// hardcoded list here would be a third copy of information Drizzle already
// owns (packages/core/src/db/schema/tables.ts is the source of truth; a
// hardcoded copy in packages/core/src/db/schema/schema.integration.test.ts
// had already silently drifted before this was written). Adding/renaming a
// table or extension never requires touching this file.
const EXPECTED_TABLES = Object.values(schema)
	.filter((value) => is(value, PgTable))
	.map((table) => getTableConfig(table as PgTable).name);

const EXPECTED_EXTENSIONS = REQUIRED_EXTENSIONS;

async function main() {
	const baseUrl = process.argv[2] ?? process.env.SMOKE_TEST_BASE_URL;
	if (!baseUrl) {
		throw new Error(
			"Usage: smoke-test-dev.ts <base-url> (or set SMOKE_TEST_BASE_URL) — e.g. https://questlog-dev.fly.dev",
		);
	}
	if (!process.env.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is not set — this script connects directly to the target environment's database (the DEV_DATABASE_URL GitHub secret) to verify schema/extensions.",
		);
	}

	console.log(`Smoke-testing ${baseUrl}`);

	// 1. /health
	const health = (await fetch(`${baseUrl}/health`).then((r) => r.json())) as {
		status?: string;
	};
	if (health.status !== "ok") {
		throw new Error(
			`/health returned unexpected body: ${JSON.stringify(health)}`,
		);
	}
	console.log("  /health OK");

	// 2. campaign.create -> campaign.list through the real, live tRPC API.
	const client = createTRPCClient<AppRouter>({
		links: [httpBatchLink({ url: `${baseUrl}/trpc`, transformer: superjson })],
	});

	const campaign = await client.campaign.create.mutate({
		name: `T-036 smoke-test-dev ${new Date().toISOString()}`,
		theme: "fantasy",
	});
	console.log(`  campaign.create OK (${campaign.id})`);

	try {
		const campaigns = await client.campaign.list.query();
		if (!campaigns.some((c) => c.id === campaign.id)) {
			throw new Error(
				"campaign.list did not include the campaign just created",
			);
		}
		console.log("  campaign.list OK");

		// 3. Schema check — direct Postgres connection, bypassing the app.
		const tableRows = await db.execute(sql`
			SELECT table_name FROM information_schema.tables
			WHERE table_schema = 'public'
		`);
		const tables = new Set(
			tableRows.map((r) => (r as Record<string, unknown>).table_name),
		);
		const missingTables = EXPECTED_TABLES.filter((t) => !tables.has(t));
		if (missingTables.length > 0) {
			throw new Error(`Missing expected table(s): ${missingTables.join(", ")}`);
		}
		console.log(
			`  schema OK (${EXPECTED_TABLES.length} expected tables present)`,
		);

		// 4. Extensions check.
		const extRows = await db.execute(sql`SELECT extname FROM pg_extension`);
		const extensions = new Set(
			extRows.map((r) => (r as Record<string, unknown>).extname),
		);
		const missingExtensions = EXPECTED_EXTENSIONS.filter(
			(e) => !extensions.has(e),
		);
		if (missingExtensions.length > 0) {
			throw new Error(
				`Missing expected extension(s): ${missingExtensions.join(", ")}`,
			);
		}
		console.log(`  extensions OK (${EXPECTED_EXTENSIONS.join(", ")})`);

		// 5. Migration drift check — every migration in the journal actually
		// applied to this database, not just that `migrate.ts` exited 0 at
		// some point in the past. Compares counts rather than re-deriving
		// drizzle-orm's internal hash scheme, so it needs no maintenance as
		// migrations are added.
		const journal = JSON.parse(
			readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf-8"),
		) as { entries: unknown[] };
		const appliedRows = await db.execute(
			sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
		);
		const appliedCount = (appliedRows[0] as { count: number }).count;
		if (appliedCount < journal.entries.length) {
			throw new Error(
				`Migration drift: journal has ${journal.entries.length} entries, only ${appliedCount} applied to this database`,
			);
		}
		console.log(
			`  migrations OK (${appliedCount}/${journal.entries.length} applied)`,
		);
	} finally {
		// 6. Clean up — scoped delete by the exact id this script created,
		// never an unscoped delete.
		await db.execute(sql`DELETE FROM campaigns WHERE id = ${campaign.id}`);
		console.log(`  cleaned up campaign ${campaign.id}`);
	}

	console.log(
		`PASS — /health -> campaign.create -> campaign.list -> schema -> extensions -> cleanup succeeded against ${baseUrl}.`,
	);
}

main()
	.catch((err) => {
		console.error(
			"FAIL —",
			err instanceof Error ? (err.stack ?? err.message) : err,
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$client.end();
	});
