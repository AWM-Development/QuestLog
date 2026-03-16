import cors from "@fastify/cors";
import {
	type FastifyTRPCPluginOptions,
	fastifyTRPCPlugin,
} from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import type { Database } from "./db/index.js";
import { type AppRouter, appRouter } from "./routers/_app.js";
import {
	type StorageProvider,
	createLocalFilesystemStorage,
} from "./services/storage.service.js";
import { createContextFactory } from "./trpc.js";

export interface BuildAppOptions {
	db: Database;
	storage?: StorageProvider;
}

export function buildApp({ db, storage: storageOption }: BuildAppOptions) {
	const storage =
		storageOption ??
		createLocalFilesystemStorage({
			basePath: process.env.UPLOAD_PATH ?? "uploads",
		});
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
			createContext: createContextFactory(db, storage),
		} satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
	});

	return app;
}
