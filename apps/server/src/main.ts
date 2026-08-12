import { db } from "@questlog/core/db/index.js";
import { buildApp } from "./server.js";

/**
 * Lazy + graceful, not a static import: `OBSERVABILITY_DATABASE_URL` isn't
 * in the deployed Fly secrets list yet (`Docs/DEPLOY_SETUP_CHECKLIST.md`
 * only sets `DATABASE_URL`/API keys) — a static
 * `import "@questlog/observability/db/index.js"` throws synchronously at
 * module-load time on an unset/invalid var (`assertValidObservabilityDatabaseUrl`),
 * which would crash the whole server's boot over one router's dependency.
 * Same non-fatal shape as `packages/observability/src/cli.ts`'s own
 * `warnIngestionSkipped` — the comment router (T-059) simply throws per-request
 * via `requireObservabilityDb` (trpc.ts) until Alex provisions the secret.
 */
async function loadObservabilityDb() {
	try {
		const mod = await import("@questlog/observability/db/index.js");
		return mod.db;
	} catch (err) {
		console.warn(
			`[observability] comment endpoints disabled — ${err instanceof Error ? err.message : String(err)}`,
		);
		return undefined;
	}
}

const observabilityDb = await loadObservabilityDb();
const app = buildApp({ db, observabilityDb, autoProcessUploads: true });

const start = async () => {
	const port = Number(process.env.PORT) || 3000;
	await app.listen({ port, host: "0.0.0.0" });
	console.log(`Server listening on http://localhost:${port}`);
};

start().catch((err: unknown) => {
	const code =
		err &&
		typeof err === "object" &&
		"code" in err &&
		typeof (err as { code: unknown }).code === "string"
			? (err as { code: string }).code
			: "";
	if (code === "EADDRINUSE") {
		const port = Number(process.env.PORT) || 3000;
		console.error(
			`Port ${port} is already in use — the API did not start. Stop the other process (often a leftover dev server) or pick a new port:
  macOS/Linux: lsof -i :${port}   # then kill the PID
  Or set PORT in .env to a free port and set VITE_API_URL to http://localhost:<that-port>/trpc`,
		);
	}
	console.error(err);
	process.exit(1);
});
