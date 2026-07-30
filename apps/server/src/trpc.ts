import type { Database } from "@questlog/core/db/index.js";
import { mapDomainError } from "@questlog/core/lib/errors.js";
import type { StorageProvider } from "@questlog/core/services/storage.service.js";
import { TRPCError, initTRPC } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import superjson from "superjson";

export interface Context {
	db: Database;
	storage: StorageProvider;
}

/** Factory used by the Fastify adapter at request time. */
export function createContextFactory(db: Database, storage: StorageProvider) {
	return (_opts: CreateFastifyContextOptions): Context => {
		return { db, storage };
	};
}

const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				name: error.cause?.name,
			},
		};
	},
});

export const router = t.router;
export const procedure = t.procedure;

/**
 * Wraps an async service call and translates domain errors into tRPC errors.
 * Use in router handlers to keep service code free of tRPC imports.
 *
 * tRPC v11 catches resolver errors internally before middleware can intercept
 * them, so a middleware-based approach doesn't work. This wrapper is called
 * explicitly in each handler instead.
 */
/** Map numeric HTTP status to the closest tRPC error code. */
const httpToTrpcCode: Record<number, TRPCError["code"]> = {
	400: "BAD_REQUEST",
	404: "NOT_FOUND",
	429: "TOO_MANY_REQUESTS",
	500: "INTERNAL_SERVER_ERROR",
};

export async function withErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		const mapped = mapDomainError(error);
		const trpcCode = httpToTrpcCode[mapped.code] ?? "INTERNAL_SERVER_ERROR";

		// For truly unknown errors (mapDomainError returns 500 fallback),
		// re-throw as-is so tRPC's built-in handler preserves the stack.
		if (
			mapped.code === 500 &&
			mapped.message === "An unexpected error occurred"
		) {
			throw error;
		}

		throw new TRPCError({
			code: trpcCode,
			message: mapped.message,
			cause: error instanceof Error ? error : undefined,
		});
	}
}
