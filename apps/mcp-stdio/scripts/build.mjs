import { build } from "esbuild";

// `@questlog/core`, `@questlog/mcp`, and `@questlog/shared` are consumed as
// workspace TypeScript source (see Docs/IMPLEMENTATION_NOTES.md § TypeScript
// & Module Resolution) — none publishes a plain-`node`-runnable entry point
// on its own. `tsc` alone leaves their bare-specifier imports unresolved at
// runtime (it only rewrites `.ts` -> `.js`, never bare specifiers), so
// bundling is what makes `dist/main.js` a real standalone artifact a
// stdio-spawning MCP client can run directly. Real npm dependencies stay
// external (already in node_modules at run time, no need to inline them).
await build({
	entryPoints: ["src/main.ts"],
	outfile: "dist/main.js",
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	external: [
		"@modelcontextprotocol/sdk",
		"@modelcontextprotocol/sdk/*",
		"drizzle-orm",
		"drizzle-orm/*",
		"postgres",
		"zod",
	],
	logLevel: "info",
});
