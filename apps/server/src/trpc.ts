import { TRPCError, initTRPC } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import superjson from "superjson";
import type { Database } from "./db/index.js";
import {
	ExtractionNotSupportedError,
	LlmApiError,
	NotFoundError,
	ValidationError,
} from "./lib/errors.js";
import type { StorageProvider } from "./services/storage.service.js";

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
export async function withErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof NotFoundError) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: error.message,
				cause: error,
			});
		}
		if (error instanceof ValidationError) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: error.message,
				cause: error,
			});
		}
		if (error instanceof ExtractionNotSupportedError) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: error.message,
				cause: error,
			});
		}
		if (error instanceof LlmApiError) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: error.message,
				cause: error,
			});
		}
		throw error;
	}
}
