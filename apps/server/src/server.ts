import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import {
	type FastifyTRPCPluginOptions,
	fastifyTRPCPlugin,
} from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import type { Database } from "./db/index.js";
import { type AppRouter, appRouter } from "./routers/_app.js";
import { importService } from "./services/import.service.js";
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

	app.register(multipart, {
		limits: {
			fileSize: 50 * 1024 * 1024, // 50MB, per PRD 4.1
		},
	});

	app.get("/health", async () => {
		return { status: "ok" };
	});

	app.post("/upload/source", async (request, reply) => {
		const query = request.query as { campaignId?: string };
		if (!query.campaignId) {
			return reply.status(400).send({ error: "campaignId is required" });
		}

		const file = await (request as any).file();
		if (!file) {
			return reply.status(400).send({ error: "file is required" });
		}

		const chunks: Buffer[] = [];
		for await (const chunk of file.file) {
			chunks.push(
				typeof chunk === "string" ? Buffer.from(chunk, "utf-8") : chunk,
			);
		}
		const content = Buffer.concat(chunks);

		const source = await importService.createFileSource(db, storage, {
			campaignId: query.campaignId,
			filename: file.filename,
			mimeType: file.mimetype,
			sizeBytes: content.length,
			content,
		});

		return reply.send(source);
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
