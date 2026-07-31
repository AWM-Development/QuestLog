import { createHash, randomBytes } from "node:crypto";

/** Rejects with a labeled timeout error if `promise` doesn't settle in time — used by manual MCP smoke/verification scripts (`apps/server/scripts`, `apps/mcp-stdio/scripts`) to fail fast on a hung handshake or tool call instead of blocking forever. */
export function withTimeout<T>(
	promise: Promise<T>,
	label: string,
	timeoutMs: number,
): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			setTimeout(
				() => reject(new Error(`Timed out after ${timeoutMs}ms: ${label}`)),
				timeoutMs,
			);
		}),
	]);
}

/** A fresh PKCE code_verifier/code_challenge (S256) pair, for scripts that drive the MCP OAuth `/authorize` flow directly rather than through a real browser redirect. */
export function makePkcePair(): {
	codeVerifier: string;
	codeChallenge: string;
} {
	const codeVerifier = randomBytes(32).toString("base64url");
	const codeChallenge = createHash("sha256")
		.update(codeVerifier)
		.digest("base64url");
	return { codeVerifier, codeChallenge };
}

/** The full MCP tool roster QuestLog's server registers — kept here once so smoke scripts asserting "the server serves every expected tool" don't hand-maintain their own copy. Update alongside `packages/mcp/src/server.ts`'s `register*` calls. */
export const EXPECTED_TOOLS = [
	"query_lore",
	"prep_brief",
	"list_campaigns",
	"create_campaign",
	"list_entities",
	"get_entity",
	"create_entity",
	"append_entity_note",
	"log_session",
	"confirm_log_session",
	"ingest_text",
	"get_source_status",
	"help",
] as const;
