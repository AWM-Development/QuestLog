import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-helpers.js";
import { OAuthError } from "../lib/errors.js";
import { mcpOauthService } from "./mcp-oauth.service.js";

const { db, close } = createTestDb();

afterAll(async () => {
	await close();
});

beforeEach(async () => {
	await db.execute(sql`BEGIN`);
});

afterEach(async () => {
	await db.execute(sql`ROLLBACK`);
});

/** A PKCE verifier + its S256 challenge, matching RFC 7636. */
function makePkcePair() {
	const codeVerifier = randomBytes(32).toString("base64url");
	const codeChallenge = createHash("sha256")
		.update(codeVerifier)
		.digest("base64url");
	return { codeVerifier, codeChallenge };
}

async function registerAndAuthorize(overrides?: { resource?: string }) {
	const client = await mcpOauthService.registerClient(db, {
		redirectUri: "https://claude.ai/api/mcp/callback",
	});
	const { codeVerifier, codeChallenge } = makePkcePair();
	const resource = overrides?.resource ?? "https://questlog.example.com/mcp";
	const { code } = await mcpOauthService.createAuthorizationCode(db, {
		clientId: client.clientId,
		codeChallenge,
		resource,
	});
	return { client, code, codeVerifier, resource };
}

describe("mcpOauthService", () => {
	describe("registerClient", () => {
		it("generates a clientId and stores the redirect URI", async () => {
			const result = await mcpOauthService.registerClient(db, {
				redirectUri: "https://claude.ai/api/mcp/callback",
			});

			expect(result.clientId).toBeDefined();
			expect(typeof result.clientId).toBe("string");
			expect(result.redirectUri).toBe("https://claude.ai/api/mcp/callback");
		});

		it("generates a different clientId on each call", async () => {
			const a = await mcpOauthService.registerClient(db, {
				redirectUri: "https://claude.ai/api/mcp/callback",
			});
			const b = await mcpOauthService.registerClient(db, {
				redirectUri: "https://claude.ai/api/mcp/callback",
			});

			expect(a.clientId).not.toBe(b.clientId);
		});
	});

	describe("getClient", () => {
		it("returns the registered client", async () => {
			const registered = await mcpOauthService.registerClient(db, {
				redirectUri: "https://claude.ai/api/mcp/callback",
			});

			const found = await mcpOauthService.getClient(db, registered.clientId);
			expect(found?.redirectUri).toBe("https://claude.ai/api/mcp/callback");
		});

		it("returns null for an unregistered clientId", async () => {
			const found = await mcpOauthService.getClient(db, "nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("createAuthorizationCode + exchangeAuthorizationCode", () => {
		it("issues an access token and refresh token for a valid exchange", async () => {
			const { client, code, codeVerifier, resource } =
				await registerAndAuthorize();

			const tokens = await mcpOauthService.exchangeAuthorizationCode(db, {
				code,
				clientId: client.clientId,
				codeVerifier,
				resource,
			});

			expect(tokens.accessToken).toBeDefined();
			expect(tokens.refreshToken).toBeDefined();
			expect(tokens.accessToken).not.toBe(tokens.refreshToken);
			expect(tokens.expiresAt).toBeInstanceOf(Date);
		});

		it("rejects a code whose code_verifier doesn't match the original code_challenge", async () => {
			const { client, code, resource } = await registerAndAuthorize();

			await expect(
				mcpOauthService.exchangeAuthorizationCode(db, {
					code,
					clientId: client.clientId,
					codeVerifier: "wrong-verifier",
					resource,
				}),
			).rejects.toThrow(OAuthError);
		});

		it("rejects a code that has already been redeemed", async () => {
			const { client, code, codeVerifier, resource } =
				await registerAndAuthorize();

			await mcpOauthService.exchangeAuthorizationCode(db, {
				code,
				clientId: client.clientId,
				codeVerifier,
				resource,
			});

			await expect(
				mcpOauthService.exchangeAuthorizationCode(db, {
					code,
					clientId: client.clientId,
					codeVerifier,
					resource,
				}),
			).rejects.toThrow(OAuthError);
		});

		it("rejects an expired authorization code", async () => {
			const client = await mcpOauthService.registerClient(db, {
				redirectUri: "https://claude.ai/api/mcp/callback",
			});
			const { codeVerifier, codeChallenge } = makePkcePair();
			const resource = "https://questlog.example.com/mcp";
			const rawCode = "expired-test-code";
			const hashedCode = createHash("sha256").update(rawCode).digest("hex");
			await db.execute(sql`
				INSERT INTO mcp_oauth_codes (code, client_id, code_challenge, resource, expires_at, used)
				VALUES (${hashedCode}, ${client.clientId}, ${codeChallenge}, ${resource}, now() - interval '1 minute', false)
			`);

			await expect(
				mcpOauthService.exchangeAuthorizationCode(db, {
					code: rawCode,
					clientId: client.clientId,
					codeVerifier,
					resource,
				}),
			).rejects.toThrow(OAuthError);
		});

		it("rejects a code redeemed by a different client_id", async () => {
			const { code, codeVerifier, resource } = await registerAndAuthorize();
			const otherClient = await mcpOauthService.registerClient(db, {
				redirectUri: "https://other.example.com/callback",
			});

			await expect(
				mcpOauthService.exchangeAuthorizationCode(db, {
					code,
					clientId: otherClient.clientId,
					codeVerifier,
					resource,
				}),
			).rejects.toThrow(OAuthError);
		});

		it("rejects a resource parameter that doesn't match the one from /authorize", async () => {
			const { client, code, codeVerifier } = await registerAndAuthorize();

			await expect(
				mcpOauthService.exchangeAuthorizationCode(db, {
					code,
					clientId: client.clientId,
					codeVerifier,
					resource: "https://attacker.example.com/mcp",
				}),
			).rejects.toThrow(OAuthError);
		});
	});

	describe("refreshAccessToken", () => {
		it("issues a new access token and rotates the refresh token", async () => {
			const { client, code, codeVerifier, resource } =
				await registerAndAuthorize();
			const first = await mcpOauthService.exchangeAuthorizationCode(db, {
				code,
				clientId: client.clientId,
				codeVerifier,
				resource,
			});

			const second = await mcpOauthService.refreshAccessToken(db, {
				refreshToken: first.refreshToken,
				clientId: client.clientId,
			});

			expect(second.accessToken).toBeDefined();
			expect(second.refreshToken).toBeDefined();
			expect(second.accessToken).not.toBe(first.accessToken);
			expect(second.refreshToken).not.toBe(first.refreshToken);
		});

		it("rejects the old refresh token once it has been rotated", async () => {
			const { client, code, codeVerifier, resource } =
				await registerAndAuthorize();
			const first = await mcpOauthService.exchangeAuthorizationCode(db, {
				code,
				clientId: client.clientId,
				codeVerifier,
				resource,
			});
			await mcpOauthService.refreshAccessToken(db, {
				refreshToken: first.refreshToken,
				clientId: client.clientId,
			});

			await expect(
				mcpOauthService.refreshAccessToken(db, {
					refreshToken: first.refreshToken,
					clientId: client.clientId,
				}),
			).rejects.toThrow(OAuthError);
		});

		it("rejects an unknown refresh token", async () => {
			const client = await mcpOauthService.registerClient(db, {
				redirectUri: "https://claude.ai/api/mcp/callback",
			});

			await expect(
				mcpOauthService.refreshAccessToken(db, {
					refreshToken: "nonexistent-refresh-token",
					clientId: client.clientId,
				}),
			).rejects.toThrow(OAuthError);
		});
	});

	describe("validateAccessToken", () => {
		it("returns the owning clientId for a valid access token", async () => {
			const { client, code, codeVerifier, resource } =
				await registerAndAuthorize();
			const tokens = await mcpOauthService.exchangeAuthorizationCode(db, {
				code,
				clientId: client.clientId,
				codeVerifier,
				resource,
			});

			const result = await mcpOauthService.validateAccessToken(
				db,
				tokens.accessToken,
			);
			expect(result?.clientId).toBe(client.clientId);
		});

		it("returns null for an unknown access token", async () => {
			const result = await mcpOauthService.validateAccessToken(
				db,
				"nonexistent-access-token",
			);
			expect(result).toBeNull();
		});
	});
});
