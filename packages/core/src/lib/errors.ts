export class NotFoundError extends Error {
	constructor(entity: string, id: string) {
		super(`${entity} not found: ${id}`);
		this.name = "NotFoundError";
	}
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

/** Thrown when a MIME type is not supported for text extraction (e.g. PDF/DOCX stub). */
export class ExtractionNotSupportedError extends Error {
	constructor(mimeType: string) {
		super(`Text extraction not supported for type: ${mimeType}`);
		this.name = "ExtractionNotSupportedError";
	}
}

/** Thrown when the LLM API returns an error (rate limit, timeout, invalid key, etc.). */
export class LlmApiError extends Error {
	public readonly statusCode?: number;
	public readonly errorType?: string;
	public readonly retryAfter?: number;

	constructor(
		message: string,
		opts?: { statusCode?: number; errorType?: string; retryAfter?: number },
	) {
		super(message);
		this.name = "LlmApiError";
		this.statusCode = opts?.statusCode;
		this.errorType = opts?.errorType;
		this.retryAfter = opts?.retryAfter;
	}
}

/**
 * OAuth 2.1 spec-shaped error (RFC 6749 §5.2: an `error` code from the
 * spec's fixed vocabulary plus a human-readable `error_description`).
 * Thrown by mcp-oauth.service and mapped directly to the OAuth REST routes'
 * JSON error body — deliberately not funneled through `mapDomainError`,
 * which is shaped for tRPC/SSE consumers, not OAuth clients.
 */
export class OAuthError extends Error {
	public readonly oauthErrorCode: string;
	public readonly status: number;

	constructor(oauthErrorCode: string, message: string, status = 400) {
		super(message);
		this.name = "OAuthError";
		this.oauthErrorCode = oauthErrorCode;
		this.status = status;
	}
}

/**
 * Maps a domain error to an HTTP status code and message.
 * Used by both the tRPC `withErrorHandling` wrapper and the SSE streaming endpoint
 * so error classification lives in one place.
 */
export function mapDomainError(error: unknown): {
	code: number;
	message: string;
} {
	if (error instanceof NotFoundError) {
		return { code: 404, message: error.message };
	}
	if (error instanceof ValidationError) {
		return { code: 400, message: error.message };
	}
	if (error instanceof ExtractionNotSupportedError) {
		return { code: 400, message: error.message };
	}
	if (error instanceof LlmApiError) {
		if (error.statusCode === 429 || error.statusCode === 529) {
			return {
				code: 429,
				message:
					error.statusCode === 429
						? "LLM rate limit exceeded. Please try again shortly."
						: "LLM API is temporarily overloaded. Please retry.",
			};
		}
		return { code: 500, message: error.message };
	}
	if (
		error instanceof Error &&
		error.message.includes("violates foreign key constraint")
	) {
		return { code: 400, message: "Referenced resource does not exist" };
	}
	return { code: 500, message: "An unexpected error occurred" };
}
