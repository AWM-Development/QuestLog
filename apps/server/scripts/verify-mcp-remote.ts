import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { db } from "@questlog/core/db/index.js";
import { deleteCampaignTree } from "@questlog/core/db/test-helpers.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import {
	makePkcePair,
	withTimeout,
} from "@questlog/shared/testing/mcp-verification.js";

// The automatable half of T-034 (Docs/tickets/in-progress/T-034-deploy-connect-claude-project.md):
// exercises the full remote MCP flow — discover -> register -> authorize ->
// token -> connect -> tools/list -> call every registered tool — against a
// real deployed base URL (questlog-dev/questlog-prod), not a locally-booted
// server the way apps/server/scripts/mcp-remote-smoke.ts (T-030) does. Same
// scripted-form-submission technique as that script for /authorize, but the
// passphrase and target URL are both external inputs here since this script
// doesn't control the server process.

const CALL_TIMEOUT_MS = 15_000;
const SOURCE_POLL_TIMEOUT_MS = 60_000;
const SOURCE_POLL_INTERVAL_MS = 2_000;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Caller must have already checked `result.isError` (see callRaw). */
function parseJsonContent(result: {
	content: Array<{ type: string; text?: string }>;
}) {
	const text = result.content.find((c) => c.type === "text")?.text;
	if (!text) throw new Error("Tool result had no text content");
	return JSON.parse(text);
}

async function main() {
	const baseUrl = process.argv[2] ?? process.env.VERIFY_MCP_BASE_URL;
	if (!baseUrl) {
		throw new Error(
			"Usage: verify-mcp-remote.ts <base-url> (or set VERIFY_MCP_BASE_URL) — e.g. https://questlog-dev.fly.dev",
		);
	}
	const accessPassphrase = process.env.MCP_ACCESS_PASSPHRASE;
	if (!accessPassphrase) {
		throw new Error(
			"MCP_ACCESS_PASSPHRASE is not set locally — must match the passphrase configured on the target server (`fly secrets list -c fly.dev.toml`), so this script can drive /authorize the same way a real client would.",
		);
	}
	if (!process.env.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is not set — this script connects directly to the target environment's database to create/clean up its own throwaway campaign (no create_campaign MCP tool exists yet, M-REMOTE.8/G-005).",
		);
	}

	console.log(`Verifying remote MCP flow against ${baseUrl}`);

	const campaign = await campaignService.create(db, {
		name: `T-034 verify-mcp-remote ${new Date().toISOString()}`,
		theme: "verification",
	});
	console.log(`Created throwaway campaign ${campaign.id}`);

	let client: Client | undefined;
	try {
		// 1. Discover.
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

		// 3. Authorize — submit the passphrase-gated form directly.
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
			const body = await authorizeResponse.text();
			throw new Error(
				`/authorize did not redirect (status ${authorizeResponse.status}) — passphrase rejected or server misconfigured? Body: ${body}`,
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

		// 5. Connect.
		const transport = new StreamableHTTPClientTransport(
			new URL(`${baseUrl}/mcp`),
			{
				requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
			},
		);
		client = new Client({
			name: "questlog-mcp-verify-remote",
			version: "0.0.0",
		});
		await withTimeout(
			client.connect(transport),
			"MCP initialize handshake",
			CALL_TIMEOUT_MS,
		);
		console.log(`Initialize handshake succeeded against ${baseUrl}/mcp`);

		const { tools } = await withTimeout(
			client.listTools(),
			"tools/list",
			CALL_TIMEOUT_MS,
		);
		const names = tools.map((tool) => tool.name).sort();
		console.log(`Server reported ${names.length} tool(s): ${names.join(", ")}`);

		// 6. Call every tool with minimal valid input against the throwaway campaign.
		//
		// No hardcoded "expected tools" roster to keep in sync by hand — the
		// coverage check below (Step 7) derives the exercised set from the
		// `callRaw` calls actually made, so a new tool this script forgets to
		// call surfaces as a visible warning instead of silently going
		// unverified.
		const calledTools = new Set<string>();
		const activeClient = client;
		const callRaw = async (name: string, args: Record<string, unknown>) => {
			const result = (await withTimeout(
				activeClient.callTool({ name, arguments: args }),
				`tools/call ${name}`,
				CALL_TIMEOUT_MS,
			)) as {
				content: Array<{ type: string; text?: string }>;
				isError?: boolean;
			};
			if (result.isError) {
				const text = result.content.find((c) => c.type === "text")?.text;
				throw new Error(`Tool call returned isError: ${text}`);
			}
			calledTools.add(name);
			console.log(`  ${name} OK`);
			return result;
		};
		const call = async (name: string, args: Record<string, unknown>) =>
			parseJsonContent(await callRaw(name, args));

		console.log("Calling every tool:");

		// Voyage's free tier caps at 3 RPM — run every tool that doesn't touch
		// embeddings first, so a rate-limit 429 on the embedding-heavy tools
		// below (query_lore's search embed, confirm_log_session's chunk embed)
		// doesn't cost us coverage of the rest.
		await call("list_campaigns", {});
		// help returns plain onboarding text, not JSON — call it directly.
		await callRaw("help", {});
		await call("prep_brief", { campaignId: campaign.id });

		const entity = await call("create_entity", {
			campaignId: campaign.id,
			name: "Verification NPC",
			type: "npc",
			description: "Created by verify-mcp-remote.ts",
		});
		const entityId = entity.id as string;

		await call("get_entity", { campaignId: campaign.id, entityId });
		await call("list_entities", { campaignId: campaign.id });
		await call("append_entity_note", {
			entityId,
			note: "Verified via verify-mcp-remote.ts",
		});

		const ingested = await call("ingest_text", {
			campaignId: campaign.id,
			title: "Verification source",
			content:
				"Verification NPC is a minor merchant met during the T-034 remote verification pass.",
		});
		const sourceId = (ingested.source as { id: string }).id;

		const deadline = Date.now() + SOURCE_POLL_TIMEOUT_MS;
		let sourceStatus = "pending";
		while (Date.now() < deadline) {
			const source = await call("get_source_status", {
				campaignId: campaign.id,
				sourceId,
			});
			sourceStatus = source.status as string;
			if (sourceStatus === "done" || sourceStatus === "error") break;
			await sleep(SOURCE_POLL_INTERVAL_MS);
		}
		if (sourceStatus === "error") {
			throw new Error("ingest_text source processing ended in status 'error'");
		}
		if (sourceStatus !== "done") {
			console.log(
				`  WARNING — source still '${sourceStatus}' after ${SOURCE_POLL_TIMEOUT_MS}ms; query_lore below may return no results`,
			);
		}

		await call("query_lore", {
			campaignId: campaign.id,
			query: "Who is the merchant NPC?",
		});

		const preview = await call("log_session", {
			campaignId: campaign.id,
			content: "The party met Verification NPC and traded for supplies.",
			title: "Verification session",
		});
		await call("confirm_log_session", { token: preview.token as string });

		// 7. Coverage check — anything the server reports that this script never
		// called is invisible to the sequence above, so surface it explicitly
		// rather than silently reporting PASS having verified fewer tools than
		// actually exist.
		const uncalled = names.filter((name) => !calledTools.has(name));
		if (uncalled.length > 0) {
			console.log(
				`  WARNING — server reports tool(s) this script never called: ${uncalled.join(", ")} (add a call for it above)`,
			);
		}

		console.log(
			`PASS — full discover -> authorize -> token -> connect -> tools/list -> every-tool sequence succeeded against ${baseUrl}.`,
		);
	} finally {
		if (client) await client.close();
		await deleteCampaignTree(db, campaign.id);
		console.log(`Cleaned up throwaway campaign ${campaign.id}`);
		await db.$client.end();
	}
}

main().catch((err) => {
	console.error(
		"FAIL —",
		err instanceof Error ? (err.stack ?? err.message) : err,
	);
	process.exitCode = 1;
});
