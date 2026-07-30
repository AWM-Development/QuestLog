import { z } from "zod";

/** RFC 7591 Dynamic Client Registration request — any client may self-register, so this only validates shape. */
export const registerBodySchema = z
	.object({
		redirect_uris: z.array(z.string().url()).min(1),
	})
	.passthrough();

/** Shared by GET /authorize's query string and POST /authorize's form body — RFC 8414 discovery + RFC 7636 PKCE (S256) + RFC 8707 `resource`. */
export const authorizeRequestSchema = z.object({
	response_type: z.literal("code"),
	client_id: z.string().min(1),
	redirect_uri: z.string().url(),
	code_challenge: z.string().min(1),
	code_challenge_method: z.literal("S256"),
	resource: z.string().url(),
	state: z.string().optional(),
});

export const authorizeFormBodySchema = authorizeRequestSchema.extend({
	passphrase: z.string(),
});

export const tokenBodySchema = z.discriminatedUnion("grant_type", [
	z.object({
		grant_type: z.literal("authorization_code"),
		code: z.string().min(1),
		client_id: z.string().min(1),
		code_verifier: z.string().min(1),
		resource: z.string().url(),
	}),
	z.object({
		grant_type: z.literal("refresh_token"),
		refresh_token: z.string().min(1),
		client_id: z.string().min(1),
	}),
]);
