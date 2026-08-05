import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runIngestCli } from "./cli.js";
import * as schema from "./schema/tables.js";

const fixturesDir = fileURLToPath(new URL("./__fixtures__", import.meta.url));

// Graceful-degradation rationale: Docs/IMPLEMENTATION_NOTES.md § T-095.
describe("runIngestCli — graceful degradation (T-095)", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it("logs a warning and resolves cleanly when OBSERVABILITY_DATABASE_URL is unset", async () => {
		const loadDb = () =>
			Promise.reject(
				new Error(
					"OBSERVABILITY_DATABASE_URL environment variable is required",
				),
			);

		await expect(
			runIngestCli([`${fixturesDir}/T-999.usage.json`], loadDb),
		).resolves.toBeUndefined();

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0]?.[0]).toContain(
			"OBSERVABILITY_DATABASE_URL environment variable is required",
		);
	});

	it("logs a warning and resolves cleanly when OBSERVABILITY_DATABASE_URL points at an unreachable host", async () => {
		const client = postgres("postgres://user:pass@127.0.0.1:1/db", {
			connect_timeout: 2,
			max: 1,
		});
		const unreachableDb = drizzle(client, { schema });
		const loadDb = () => Promise.resolve({ db: unreachableDb });

		await expect(
			runIngestCli([`${fixturesDir}/T-999.usage.json`], loadDb),
		).resolves.toBeUndefined();

		expect(warnSpy).toHaveBeenCalledTimes(1);
		await client.end();
	});

	it("prints a usage error and sets a nonzero exit code when no usage.json path is given", async () => {
		const originalExitCode = process.exitCode;

		await runIngestCli([]);

		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(process.exitCode).toBe(1);
		process.exitCode = originalExitCode;
	});

	it("strips a leading literal '--' token (Docs/IMPLEMENTATION_NOTES.md § T-095)", async () => {
		// A db stub that never resolves a real query — sufficient here because
		// an unstripped "--" fails before any query is attempted (readFileSync("--")).
		// biome-ignore lint/suspicious/noExplicitAny: minimal structural stub, not a real Database
		const dbStub = { $client: { end: async () => {} } } as any;
		const loadDb = () => Promise.resolve({ db: dbStub });

		await runIngestCli(
			[
				"--",
				`${fixturesDir}/T-999.usage.json`,
				`${fixturesDir}/T-999-fixture-report.md`,
			],
			loadDb,
		);

		// Unstripped, argv[0] is literally "--" — readFileSync("--") ENOENTs
		// mentioning "'--'". Stripped, it reads the real fixture and fails
		// downstream instead (dbStub has no query methods) — a distinctly
		// different message proves the fixture path was actually reached.
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0]?.[0]).not.toContain("'--'");
	});
});
