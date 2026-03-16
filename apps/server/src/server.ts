import cors from "@fastify/cors";
import {
	type FastifyTRPCPluginOptions,
	fastifyTRPCPlugin,
} from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import type { Database } from "./db/index.js";
import { type AppRouter, appRouter } from "./routers/_app.js";
import { createContextFactory } from "./trpc.js";

export interface BuildAppOptions {
	db: Database;
}

export function buildApp({ db }: BuildAppOptions) {
	const app = Fastify();

	app.register(cors, {
		origin: process.env.CORS_ORIGIN || true,
	});

	app.get("/health", async () => {
		return { status: "ok" };
	});

	app.register(fastifyTRPCPlugin, {
		prefix: "/trpc",
		trpcOptions: {
			router: appRouter,
			createContext: createContextFactory(db),
		} satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
	});

	return app;
}
