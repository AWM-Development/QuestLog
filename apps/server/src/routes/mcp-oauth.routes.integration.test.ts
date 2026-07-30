import { createHash, randomBytes } from "node:crypto";
import { createTestDb } from "@questlog/core/db/test-helpers.js";
import { sql } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { buildApp } from "../server.js";

const { db, close } = createTestDb();
const ACCESS_PASSPHRASE = "test-passphrase-123";
const app = buildApp({ db, accessPassphrase: ACCESS_PASSPHRASE });

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
	await close();
});

beforeEach(async () => {
	await db.execute(sql`BEGIN`);
});

afterEach(async () => {
	await db.execute(sql`ROLLBACK`);
});

const REDIRECT_URI = "https://claude.ai/api/mcp/callback";
const RESOURCE = "https://questlog.example.com/mcp";

function makePkcePair() {
	const codeVerifier = randomBytes(32).toString("base64url");
	const codeChallenge = createHash("sha256")
		.update(codeVerifier)
		.digest("base64url");
	return { codeVerifier, codeChallenge };
}

async function registerClient() {
	const response = await app.inject({
		method: "POST",
		url: "/register",
		payload: { redirect_uris: [REDIRECT_URI] },
	});
	return response.json().client_id as string;
}

function authorizeQuery(params: {
	clientId: string;
	codeChallenge: string;
	state?: string;
}) {
	const query = new URLSearchParams({
		response_type: "code",
		client_id: params.clientId,
		redirect_uri: REDIRECT_URI,
		code_challenge: params.codeChallenge,
		code_challenge_method: "S256",
		resource: RESOURCE,
		...(params.state ? { state: params.state } : {}),
	});
	return `/authorize?${query.toString()}`;
}

async function completeAuthorization(params: {
	clientId: string;
	codeChallenge: string;
	passphrase: string;
	state?: string;
}) {
	return app.inject({
		method: "POST",
		url: "/authorize",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		payload: new URLSearchParams({
			response_type: "code",
			client_id: params.clientId,
			redirect_uri: REDIRECT_URI,
			code_challenge: params.codeChallenge,
			code_challenge_method: "S256",
			resource: RESOURCE,
			passphrase: params.passphrase,
			...(params.state ? { state: params.state } : {}),
		}).toString(),
	});
}

describe("mcp-oauth routes", () => {
	describe("GET /.well-known/oauth-authorization-server", () => {
		it("advertises the authorize/token/register endpoints and PKCE S256 support", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/.well-known/oauth-authorization-server",
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.authorization_endpoint).toMatch(/\/authorize$/);
			expect(body.token_endpoint).toMatch(/\/token$/);
			expect(body.registration_endpoint).toMatch(/\/register$/);
			expect(body.grant_types_supported).toEqual(
				expect.arrayContaining(["authorization_code", "refresh_token"]),
			);
			expect(body.code_challenge_methods_supported).toEqual(["S256"]);
		});

		it("advertises https:// endpoints when reached via a TLS-terminating proxy's X-Forwarded-Proto header", async () => {
			// Regression coverage for server.ts's trustProxy option — see
			// IMPLEMENTATION_NOTES.md § T-034 for why this is required.
			const response = await app.inject({
				method: "GET",
				url: "/.well-known/oauth-authorization-server",
				headers: { "x-forwarded-proto": "https" },
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.issuer).toMatch(/^https:\/\//);
			expect(body.authorization_endpoint).toMatch(/^https:\/\//);
			expect(body.registration_endpoint).toMatch(/^https:\/\//);
			expect(body.token_endpoint).toMatch(/^https:\/\//);
		});
	});

	describe("POST /register", () => {
		it("registers a public client and returns a generated client_id", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/register",
				payload: { redirect_uris: [REDIRECT_URI] },
			});

			expect(response.statusCode).toBe(201);
			const body = response.json();
			expect(body.client_id).toBeDefined();
			expect(body.token_endpoint_auth_method).toBe("none");
		});
	});

	describe("full authorization code flow", () => {
		it("registers, authorizes with the correct passphrase, and exchanges the code for tokens", async () => {
			const clientId = await registerClient();
			const { codeVerifier, codeChallenge } = makePkcePair();

			const getResponse = await app.inject({
				method: "GET",
				url: authorizeQuery({ clientId, codeChallenge, state: "xyz" }),
			});
			expect(getResponse.statusCode).toBe(200);
			expect(getResponse.headers["content-type"]).toMatch(/text\/html/);

			const postResponse = await completeAuthorization({
				clientId,
				codeChallenge,
				passphrase: ACCESS_PASSPHRASE,
				state: "xyz",
			});
			expect(postResponse.statusCode).toBe(302);
			const location = new URL(postResponse.headers.location as string);
			expect(location.origin + location.pathname).toBe(REDIRECT_URI);
			const code = location.searchParams.get("code");
			expect(code).toBeTruthy();
			expect(location.searchParams.get("state")).toBe("xyz");

			const tokenResponse = await app.inject({
				method: "POST",
				url: "/token",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				payload: new URLSearchParams({
					grant_type: "authorization_code",
					code: code as string,
					client_id: clientId,
					code_verifier: codeVerifier,
					resource: RESOURCE,
				}).toString(),
			});

			expect(tokenResponse.statusCode).toBe(200);
			const tokenBody = tokenResponse.json();
			expect(tokenBody.access_token).toBeTruthy();
			expect(tokenBody.refresh_token).toBeTruthy();
			expect(tokenBody.token_type).toBe("Bearer");
		});
	});

	describe("wrong passphrase", () => {
		it("is rejected at /authorize and issues no code", async () => {
			const clientId = await registerClient();
			const { codeChallenge } = makePkcePair();

			const response = await completeAuthorization({
				clientId,
				codeChallenge,
				passphrase: "not-the-passphrase",
			});

			expect(response.statusCode).not.toBe(302);
			expect(response.headers.location).toBeUndefined();
		});
	});

	describe("POST /token", () => {
		it("rejects a code whose code_verifier doesn't match the original code_challenge", async () => {
			const clientId = await registerClient();
			const { codeChallenge } = makePkcePair();
			const postResponse = await completeAuthorization({
				clientId,
				codeChallenge,
				passphrase: ACCESS_PASSPHRASE,
			});
			const code = new URL(
				postResponse.headers.location as string,
			).searchParams.get("code");

			const tokenResponse = await app.inject({
				method: "POST",
				url: "/token",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				payload: new URLSearchParams({
					grant_type: "authorization_code",
					code: code as string,
					client_id: clientId,
					code_verifier: "wrong-verifier",
					resource: RESOURCE,
				}).toString(),
			});

			expect(tokenResponse.statusCode).toBe(400);
			expect(tokenResponse.json().error).toBe("invalid_grant");
		});

		it("rejects a used authorization code redeemed a second time", async () => {
			const clientId = await registerClient();
			const { codeVerifier, codeChallenge } = makePkcePair();
			const postResponse = await completeAuthorization({
				clientId,
				codeChallenge,
				passphrase: ACCESS_PASSPHRASE,
			});
			const code = new URL(
				postResponse.headers.location as string,
			).searchParams.get("code") as string;

			const exchangePayload = new URLSearchParams({
				grant_type: "authorization_code",
				code,
				client_id: clientId,
				code_verifier: codeVerifier,
				resource: RESOURCE,
			}).toString();

			const first = await app.inject({
				method: "POST",
				url: "/token",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				payload: exchangePayload,
			});
			expect(first.statusCode).toBe(200);

			const second = await app.inject({
				method: "POST",
				url: "/token",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				payload: exchangePayload,
			});
			expect(second.statusCode).toBe(400);
			expect(second.json().error).toBe("invalid_grant");
		});

		it("rejects an expired authorization code", async () => {
			const clientId = await registerClient();
			const { codeVerifier, codeChallenge } = makePkcePair();
			const rawCode = "expired-route-test-code";
			const hashedCode = createHash("sha256").update(rawCode).digest("hex");
			await db.execute(sql`
				INSERT INTO mcp_oauth_codes (code, client_id, code_challenge, resource, expires_at, used)
				VALUES (${hashedCode}, ${clientId}, ${codeChallenge}, ${RESOURCE}, now() - interval '1 minute', false)
			`);

			const tokenResponse = await app.inject({
				method: "POST",
				url: "/token",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				payload: new URLSearchParams({
					grant_type: "authorization_code",
					code: rawCode,
					client_id: clientId,
					code_verifier: codeVerifier,
					resource: RESOURCE,
				}).toString(),
			});

			expect(tokenResponse.statusCode).toBe(400);
			expect(tokenResponse.json().error).toBe("invalid_grant");
		});

		it("refresh_token grant issues a new access token and rotates the refresh token", async () => {
			const clientId = await registerClient();
			const { codeVerifier, codeChallenge } = makePkcePair();
			const postResponse = await completeAuthorization({
				clientId,
				codeChallenge,
				passphrase: ACCESS_PASSPHRASE,
			});
			const code = new URL(
				postResponse.headers.location as string,
			).searchParams.get("code") as string;

			const tokenResponse = await app.inject({
				method: "POST",
				url: "/token",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				payload: new URLSearchParams({
					grant_type: "authorization_code",
					code,
					client_id: clientId,
					code_verifier: codeVerifier,
					resource: RESOURCE,
				}).toString(),
			});
			const firstTokens = tokenResponse.json();

			const refreshResponse = await app.inject({
				method: "POST",
				url: "/token",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				payload: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: firstTokens.refresh_token,
					client_id: clientId,
				}).toString(),
			});

			expect(refreshResponse.statusCode).toBe(200);
			const refreshedTokens = refreshResponse.json();
			expect(refreshedTokens.access_token).not.toBe(firstTokens.access_token);
			expect(refreshedTokens.refresh_token).not.toBe(firstTokens.refresh_token);

			const reuseResponse = await app.inject({
				method: "POST",
				url: "/token",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				payload: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: firstTokens.refresh_token,
					client_id: clientId,
				}).toString(),
			});
			expect(reuseResponse.statusCode).toBe(400);
		});
	});
});
