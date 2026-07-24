import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
	mcpOauthClients,
	mcpOauthCodes,
	mcpOauthTokens,
} from "../db/schema/index.js";
import { OAuthError } from "../lib/errors.js";
import { first } from "../lib/utils.js";

const AUTHORIZATION_CODE_TTL_MS = 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

function generateOpaqueToken(): string {
	return randomBytes(32).toString("base64url");
}

/** SHA-256 hash of a bearer secret (code/access token/refresh token) — see tables.ts's mcp_oauth_* comment for why these are stored hashed, never raw. */
function hashSecret(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

/** RFC 7636 S256: base64url(SHA-256(code_verifier)) must equal the stored code_challenge. */
function matchesPkceChallenge(
	codeVerifier: string,
	codeChallenge: string,
): boolean {
	return (
		createHash("sha256").update(codeVerifier).digest("base64url") ===
		codeChallenge
	);
}

export const mcpOauthService = {
	async registerClient(db: Database, input: { redirectUri: string }) {
		const clientId = generateOpaqueToken();
		const rows = await db
			.insert(mcpOauthClients)
			.values({ clientId, redirectUri: input.redirectUri })
			.returning();
		return first(rows);
	},

	async getClient(db: Database, clientId: string) {
		const rows = await db
			.select()
			.from(mcpOauthClients)
			.where(eq(mcpOauthClients.clientId, clientId));
		return rows[0] ?? null;
	},

	async createAuthorizationCode(
		db: Database,
		input: { clientId: string; codeChallenge: string; resource: string },
	) {
		const code = generateOpaqueToken();
		const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS);
		await db.insert(mcpOauthCodes).values({
			code: hashSecret(code),
			clientId: input.clientId,
			codeChallenge: input.codeChallenge,
			resource: input.resource,
			expiresAt,
		});
		return { code, expiresAt };
	},

	async exchangeAuthorizationCode(
		db: Database,
		input: {
			code: string;
			clientId: string;
			codeVerifier: string;
			resource: string;
		},
	) {
		// Atomic conditional claim: single-use, client-bound, and expiry are all
		// enforced in the WHERE clause so a losing concurrent exchange (or a
		// replay) sees zero rows rather than racing a separate check-then-claim.
		const claimedRows = await db
			.update(mcpOauthCodes)
			.set({ used: true })
			.where(
				and(
					eq(mcpOauthCodes.code, hashSecret(input.code)),
					eq(mcpOauthCodes.clientId, input.clientId),
					eq(mcpOauthCodes.used, false),
					gt(mcpOauthCodes.expiresAt, new Date()),
				),
			)
			.returning();
		const row = claimedRows[0];
		if (!row) {
			throw new OAuthError(
				"invalid_grant",
				"Authorization code is invalid, expired, already used, or was not issued to this client",
			);
		}

		if (!matchesPkceChallenge(input.codeVerifier, row.codeChallenge)) {
			throw new OAuthError(
				"invalid_grant",
				"code_verifier does not match the original code_challenge",
			);
		}

		if (row.resource !== input.resource) {
			throw new OAuthError(
				"invalid_target",
				"resource does not match the resource requested at /authorize",
			);
		}

		return issueTokenPair(db, input.clientId);
	},

	async refreshAccessToken(
		db: Database,
		input: { refreshToken: string; clientId: string },
	) {
		// Rotation: the old row is deleted (not just read) atomically, so the
		// presented refresh token can never be redeemed a second time.
		const deletedRows = await db
			.delete(mcpOauthTokens)
			.where(
				and(
					eq(mcpOauthTokens.refreshToken, hashSecret(input.refreshToken)),
					eq(mcpOauthTokens.clientId, input.clientId),
				),
			)
			.returning();
		if (!deletedRows[0]) {
			throw new OAuthError(
				"invalid_grant",
				"refresh_token is invalid or unknown",
			);
		}

		return issueTokenPair(db, input.clientId);
	},

	async validateAccessToken(db: Database, accessToken: string) {
		const rows = await db
			.select({ clientId: mcpOauthTokens.clientId })
			.from(mcpOauthTokens)
			.where(
				and(
					eq(mcpOauthTokens.accessToken, hashSecret(accessToken)),
					gt(mcpOauthTokens.expiresAt, new Date()),
				),
			);
		return rows[0] ?? null;
	},
};

async function issueTokenPair(db: Database, clientId: string) {
	const accessToken = generateOpaqueToken();
	const refreshToken = generateOpaqueToken();
	const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
	await db.insert(mcpOauthTokens).values({
		accessToken: hashSecret(accessToken),
		refreshToken: hashSecret(refreshToken),
		clientId,
		expiresAt,
	});
	return { accessToken, refreshToken, expiresAt };
}
