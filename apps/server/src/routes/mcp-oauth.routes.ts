import type { Database } from "@questlog/core/db/index.js";
import { OAuthError } from "@questlog/core/lib/errors.js";
import { first } from "@questlog/core/lib/utils.js";
import { mcpOauthService } from "@questlog/core/services/mcp-oauth.service.js";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
	authorizeFormBodySchema,
	authorizeRequestSchema,
	registerBodySchema,
	tokenBodySchema,
} from "./mcp-oauth.schemas.js";

type AuthorizeFields = {
	response_type: "code";
	client_id: string;
	redirect_uri: string;
	code_challenge: string;
	code_challenge_method: "S256";
	resource: string;
	state?: string;
};

function baseUrl(request: { protocol: string; headers: { host?: string } }) {
	return `${request.protocol}://${request.headers.host}`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** No framework, no design system — a one-time, one-user passphrase prompt. */
function renderAuthorizeForm(fields: AuthorizeFields, error?: string): string {
	const hidden = (name: string, value: string) =>
		`<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
	return `<!doctype html>
<html>
<head><title>QuestLog MCP — Sign in</title></head>
<body>
<h1>QuestLog MCP</h1>
${error ? `<p>${escapeHtml(error)}</p>` : ""}
<form method="POST" action="/authorize">
${hidden("response_type", fields.response_type)}
${hidden("client_id", fields.client_id)}
${hidden("redirect_uri", fields.redirect_uri)}
${hidden("code_challenge", fields.code_challenge)}
${hidden("code_challenge_method", fields.code_challenge_method)}
${hidden("resource", fields.resource)}
${fields.state !== undefined ? hidden("state", fields.state) : ""}
<label for="passphrase">Passphrase</label>
<input type="password" id="passphrase" name="passphrase" autofocus>
<button type="submit">Continue</button>
</form>
</body>
</html>`;
}

/** True only if client_id is registered AND redirect_uri matches exactly — never redirect to an unregistered target. */
async function isValidClientRedirect(
	db: Database,
	clientId: string,
	redirectUri: string,
) {
	const client = await mcpOauthService.getClient(db, clientId);
	return client !== null && client.redirectUri === redirectUri;
}

function sendOAuthError(reply: FastifyReply, error: unknown) {
	if (error instanceof OAuthError) {
		return reply.status(error.status).send({
			error: error.oauthErrorCode,
			error_description: error.message,
		});
	}
	throw error;
}

export interface McpOauthRouteOptions {
	db: Database;
	/** Falsy = server misconfigured; /authorize rejects with a 500 rather than silently failing every passphrase check. */
	accessPassphrase?: string;
}

export function registerMcpOauthRoutes(
	app: FastifyInstance,
	{ db, accessPassphrase }: McpOauthRouteOptions,
) {
	app.get("/.well-known/oauth-authorization-server", async (request) => {
		const issuer = baseUrl(request);
		return {
			issuer,
			authorization_endpoint: `${issuer}/authorize`,
			token_endpoint: `${issuer}/token`,
			registration_endpoint: `${issuer}/register`,
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			code_challenge_methods_supported: ["S256"],
			token_endpoint_auth_methods_supported: ["none"],
		};
	});

	app.post("/register", async (request, reply) => {
		const parsed = registerBodySchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.status(400).send({
				error: "invalid_client_metadata",
				error_description:
					parsed.error.issues[0]?.message ?? "Invalid registration request",
			});
		}

		const redirectUri = first(parsed.data.redirect_uris);
		const client = await mcpOauthService.registerClient(db, { redirectUri });
		return reply.status(201).send({
			client_id: client.clientId,
			client_id_issued_at: Math.floor(client.registeredAt.getTime() / 1000),
			redirect_uris: [client.redirectUri],
			token_endpoint_auth_method: "none",
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
		});
	});

	app.get("/authorize", async (request, reply) => {
		const parsed = authorizeRequestSchema.safeParse(request.query);
		if (!parsed.success) {
			return reply.status(400).send({
				error: "invalid_request",
				error_description:
					parsed.error.issues[0]?.message ?? "Invalid authorization request",
			});
		}

		const fields = parsed.data;
		if (
			!(await isValidClientRedirect(db, fields.client_id, fields.redirect_uri))
		) {
			return reply.status(400).send({
				error: "invalid_request",
				error_description:
					"Unknown client_id or redirect_uri does not match registration",
			});
		}

		return reply.type("text/html").send(renderAuthorizeForm(fields));
	});

	app.post("/authorize", async (request, reply) => {
		const parsed = authorizeFormBodySchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.status(400).send({
				error: "invalid_request",
				error_description:
					parsed.error.issues[0]?.message ?? "Invalid authorization request",
			});
		}

		const fields = parsed.data;
		const validClientRedirect = await isValidClientRedirect(
			db,
			fields.client_id,
			fields.redirect_uri,
		);

		// A tampered hidden field and a wrong passphrase produce the identical
		// generic error below — an attacker resubmitting this form can't use the
		// response to tell which one they got wrong (Scope §3).
		if (
			!accessPassphrase ||
			!validClientRedirect ||
			fields.passphrase !== accessPassphrase
		) {
			if (!accessPassphrase) {
				return reply.status(500).send({
					error: "server_error",
					error_description: "MCP_ACCESS_PASSPHRASE is not configured",
				});
			}
			return reply
				.status(401)
				.type("text/html")
				.send(
					renderAuthorizeForm(
						fields,
						"Incorrect passphrase. Please try again.",
					),
				);
		}

		const { code } = await mcpOauthService.createAuthorizationCode(db, {
			clientId: fields.client_id,
			codeChallenge: fields.code_challenge,
			resource: fields.resource,
		});

		const redirectUrl = new URL(fields.redirect_uri);
		redirectUrl.searchParams.set("code", code);
		if (fields.state !== undefined) {
			redirectUrl.searchParams.set("state", fields.state);
		}
		return reply.redirect(redirectUrl.toString());
	});

	app.post("/token", async (request, reply) => {
		const parsed = tokenBodySchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.status(400).send({
				error: "invalid_request",
				error_description:
					parsed.error.issues[0]?.message ?? "Invalid token request",
			});
		}

		try {
			const tokens =
				parsed.data.grant_type === "authorization_code"
					? await mcpOauthService.exchangeAuthorizationCode(db, {
							code: parsed.data.code,
							clientId: parsed.data.client_id,
							codeVerifier: parsed.data.code_verifier,
							resource: parsed.data.resource,
						})
					: await mcpOauthService.refreshAccessToken(db, {
							refreshToken: parsed.data.refresh_token,
							clientId: parsed.data.client_id,
						});

			return reply.send({
				access_token: tokens.accessToken,
				token_type: "Bearer",
				expires_in: Math.floor(
					(tokens.expiresAt.getTime() - Date.now()) / 1000,
				),
				refresh_token: tokens.refreshToken,
			});
		} catch (error) {
			return sendOAuthError(reply, error);
		}
	});
}
