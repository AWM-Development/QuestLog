import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { db } from "@questlog/core/db/index.js";
import {
	EXPECTED_TOOLS,
	makePkcePair,
	withTimeout,
} from "@questlog/shared/testing/mcp-verification.js";
import { buildApp } from "../src/server.js";

// Proof that the real remote transport (T-030) works end to end: discover the
// protected-resource + authorization-server metadata, register a client,
// drive the passphrase-gated /authorize form, exchange the code for a token,
// then connect the SDK's own client and list tools — the same sequence a
// real MCP client (e.g. Claude.ai's Custom Connector) would perform, minus
// the browser redirect (scripted directly via fetch, same as a user would
// submit the rendered form).

const HANDSHAKE_TIMEOUT_MS = 15_000;

async function main() {
	if (!process.env.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is not set — this smoke test needs a running, migrated Postgres.",
		);
	}

	const accessPassphrase = randomUUID();
	const app = buildApp({ db, accessPassphrase });
	await app.listen({ port: 0, host: "127.0.0.1" });
	const address = app.server.address();
	if (!address || typeof address === "string") {
		throw new Error("Expected the server to bind a TCP address");
	}
	const baseUrl = `http://127.0.0.1:${address.port}`;
	console.log(`Server listening on ${baseUrl}`);

	try {
		// 1. Discover — Protected Resource Metadata names the authorization server.
		const resourceMetadata = await fetch(
			`${baseUrl}/.well-known/oauth-protected-resource`,
		).then((r) => r.json());
		console.log(
			`Discovered protected resource metadata: resource=${resourceMetadata.resource}, authorization_servers=${JSON.stringify(resourceMetadata.authorization_servers)}`,
		);
		const authServerUrl = resourceMetadata.authorization_servers[0] as string;

		const authServerMetadata = await fetch(
			`${authServerUrl}/.well-known/oauth-authorization-server`,
		).then((r) => r.json());
		console.log(
			`Discovered authorization server metadata: authorization_endpoint=${authServerMetadata.authorization_endpoint}`,
		);

		// 2. Register a public client (Dynamic Client Registration).
		const redirectUri = "https://example.com/callback";
		const registerResponse = await fetch(
			authServerMetadata.registration_endpoint,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ redirect_uris: [redirectUri] }),
			},
		).then((r) => r.json());
		const clientId = registerResponse.client_id as string;
		console.log(`Registered client: ${clientId}`);

		// 3. Authorize — submit the passphrase-gated form directly (scripted
		// stand-in for a human filling in the rendered HTML page).
		const { codeVerifier, codeChallenge } = makePkcePair();
		const resource = resourceMetadata.resource as string;
		const authorizeForm = new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			redirect_uri: redirectUri,
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
			resource,
			passphrase: accessPassphrase,
		});
		const authorizeResponse = await fetch(
			authServerMetadata.authorization_endpoint,
			{
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: authorizeForm.toString(),
				redirect: "manual",
			},
		);
		const location = authorizeResponse.headers.get("location");
		if (!location) {
			throw new Error(
				`/authorize did not redirect (status ${authorizeResponse.status}) — passphrase rejected?`,
			);
		}
		const code = new URL(location).searchParams.get("code");
		if (!code) throw new Error("No authorization code in /authorize redirect");
		console.log("Authorization code obtained");

		// 4. Token exchange.
		const tokenResponse = await fetch(authServerMetadata.token_endpoint, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				client_id: clientId,
				code_verifier: codeVerifier,
				resource,
			}).toString(),
		}).then((r) => r.json());
		const accessToken = tokenResponse.access_token as string;
		if (!accessToken) {
			throw new Error(
				`Token exchange failed: ${JSON.stringify(tokenResponse)}`,
			);
		}
		console.log("Access token obtained");

		// 5. Connect — the SDK's own client, over the real remote transport.
		const transport = new StreamableHTTPClientTransport(
			new URL(`${baseUrl}/mcp`),
			{
				requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
			},
		);
		const client = new Client({
			name: "questlog-mcp-remote-smoke",
			version: "0.0.0",
		});

		await withTimeout(
			client.connect(transport),
			"MCP initialize handshake",
			HANDSHAKE_TIMEOUT_MS,
		);
		console.log(`Initialize handshake succeeded against ${baseUrl}/mcp`);

		const { tools } = await withTimeout(
			client.listTools(),
			"tools/list",
			HANDSHAKE_TIMEOUT_MS,
		);
		const names = tools.map((tool) => tool.name).sort();
		console.log(`Server reported ${names.length} tool(s): ${names.join(", ")}`);

		const missing = EXPECTED_TOOLS.filter((name) => !names.includes(name));
		if (missing.length > 0) {
			throw new Error(`Missing expected tool(s): ${missing.join(", ")}`);
		}

		await client.close();
		console.log(
			"PASS — full discover -> authorize -> token -> connect -> tools/list sequence succeeded against a locally-running apps/server instance.",
		);
	} finally {
		await app.close();
		// postgres.js keeps its socket open until explicitly ended — without
		// this the process never exits even after a successful run.
		await db.$client.end();
	}
}

main().catch((err) => {
	console.error("FAIL —", err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
