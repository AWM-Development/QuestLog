import { build } from "esbuild";
import { EXTERNAL_PACKAGES } from "./build.externals.mjs";

// See apps/mcp-stdio/scripts/build.mjs for the precedent this mirrors: `tsc`
// alone (the previous "build" script) never resolves @questlog/shared's
// bare-specifier import to anything plain `node` can load, since that
// package ships raw TypeScript with no dist/ (Docs/IMPLEMENTATION_NOTES.md
// § "T-019"). Bundling with esbuild is what makes dist/main.js and
// dist/migrate.js real standalone artifacts a Docker image can run without
// tsx or the workspace's tsconfig `paths` mapping. Real npm dependencies
// stay external (already in node_modules at run time, no need to inline
// them) — "dotenv" must also stay external: it's a CJS package that does
// its own `require("fs")` internally, which esbuild's ESM output can't
// satisfy with a dynamic require (confirmed directly: bundling it throws
// "Dynamic require of 'fs' is not supported" at run time). It's listed as
// a real dependency (not dev-only) for exactly this reason. See
// build.externals.mjs for why the list itself lives in its own module.
await build({
	entryPoints: [
		{ in: "src/main.ts", out: "main" },
		{ in: "../../packages/core/src/db/migrate.ts", out: "db/migrate" },
	],
	outdir: "dist",
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	external: EXTERNAL_PACKAGES,
	logLevel: "info",
});
