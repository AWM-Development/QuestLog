import { db } from "@questlog/core/db/index.js";
import { buildApp } from "./server.js";

// Lazy + graceful, not a static import — see IMPLEMENTATION_NOTES.md § T-059
// for the full rationale (deployed Fly secrets don't include
// OBSERVABILITY_DATABASE_URL yet, so a static import would crash server boot).
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
