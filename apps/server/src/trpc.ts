import { TRPCError, initTRPC } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import superjson from "superjson";
import type { Database } from "./db/index.js";
import { NotFoundError, ValidationError } from "./lib/errors.js";

export interface Context {
	db: Database;
}

/** Factory used by the Fastify adapter at request time. */
export function createContextFactory(db: Database) {
	return (_opts: CreateFastifyContextOptions): Context => {
		return { db };
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
		throw error;
	}
}
