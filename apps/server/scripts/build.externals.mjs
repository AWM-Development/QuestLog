// Real npm packages esbuild leaves external when bundling apps/server's
// dist/main.js and dist/db/migrate.js (build.mjs) — already in node_modules
// at run time, no need to inline them. Split into its own side-effect-free
// module so build.deps.test.ts can import the list without triggering a
// real esbuild run.
//
// Every entry here must be a "dependencies" (not "devDependencies") entry in
// apps/server/package.json, even ones this app's own src/ never literally
// imports — T-042 split domain code into packages/core/packages/mcp without
// carrying their runtime deps along, and the Dockerfile's runtime stage only
// copies this package's own node_modules (not packages/core's), so a
// package missing here silently 500s at container boot instead of failing
// the build.
export const EXTERNAL_PACKAGES = [
	"@anthropic-ai/sdk",
	"@fastify/cors",
	"@fastify/multipart",
	"@trpc/server",
	"dotenv",
	"drizzle-orm",
	"drizzle-orm/*",
	"fastify",
	"mammoth",
	"pdf-parse",
	"postgres",
	"superjson",
	"zod",
];
