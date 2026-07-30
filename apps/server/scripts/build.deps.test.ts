import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXTERNAL_PACKAGES } from "./build.externals.mjs";

// Regression test for the T-034 deploy bug: T-042 split domain code out of
// apps/server into packages/core/packages/mcp and dropped @anthropic-ai/sdk,
// mammoth, pdf-parse, postgres from apps/server's own "dependencies" since
// this app's src/ no longer literally imports them. But build.mjs still
// bundles dist/main.js and dist/db/migrate.js with those packages left
// external, and the Dockerfile's runtime stage only copies apps/server's own
// node_modules — so a package esbuild treats as external must be a real
// "dependencies" entry here regardless of who actually writes the import,
// or the container 500s/fails its release_command at boot instead of at
// build time.
const packageJson = JSON.parse(
	readFileSync(
		fileURLToPath(new URL("../package.json", import.meta.url)),
		"utf-8",
	),
);

describe("build.mjs external packages are runtime dependencies", () => {
	it.each(EXTERNAL_PACKAGES.filter((name) => !name.includes("*")))(
		"%s is listed under apps/server/package.json's dependencies",
		(name) => {
			expect(packageJson.dependencies).toHaveProperty(name);
			expect(packageJson.devDependencies ?? {}).not.toHaveProperty(name);
		},
	);
});
