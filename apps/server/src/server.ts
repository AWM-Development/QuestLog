import { createHash } from "node:crypto";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import {
	type FastifyTRPCPluginOptions,
	fastifyTRPCPlugin,
} from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import type { Database } from "./db/index.js";
import { mapDomainError } from "./lib/errors.js";
import { type AppRouter, appRouter } from "./routers/_app.js";
import {
	conversationStreamBodySchema,
	conversationStreamParamsSchema,
} from "./routers/conversation.schemas.js";
import { conversationService } from "./services/conversation.service.js";
import { importService } from "./services/import.service.js";
import { sourceService } from "./services/source.service.js";
import {
	type StorageProvider,
	createLocalFilesystemStorage,
} from "./services/storage.service.js";
import { createContextFactory } from "./trpc.js";

/** MIME types accepted for upload, per PRD §4.1 */
const ACCEPTED_MIME_TYPES = new Set([
	"application/pdf",
	"text/markdown",
	"text/x-markdown",
	"text/plain",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Map MIME type to a short source type string stored in sources.type */
function mimeToSourceType(mime: string): string {
	const normalized = mime.toLowerCase().split(";")[0]?.trim() ?? mime;
	if (normalized === "application/pdf") return "pdf";
	if (normalized === "text/markdown" || normalized === "text/x-markdown")
		return "markdown";
	if (
		normalized ===
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	)
		return "docx";
	return "text";
}

export interface BuildAppOptions {
	db: Database;
	storage?: StorageProvider;
}

/** Postgres SQLSTATE from driver-wrapped errors (42P01 = undefined_table). */
function pgErrorCode(err: unknown): string | undefined {
	if (!err || typeof err !== "object") return undefined;
	const cause = (err as { cause?: unknown }).cause;
	if (!cause || typeof cause !== "object") return undefined;
	const code = (cause as { code?: unknown }).code;
	return typeof code === "string" ? code : undefined;
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
			fileSize: 50 * 1024 * 1024, // 50 MB per PRD §4.1
		},
	});

	app.get("/health", async () => {
		return { status: "ok" };
	});

	/**
	 * POST /api/campaigns/:campaignId/sources/upload
	 * Multipart form upload — NOT tRPC (tRPC doesn't handle multipart well).
	 * Steps:
	 *   1. Validate campaignId is a UUID
	 *   2. Accept multipart file field
	 *   3. Validate MIME type and size (≤50 MB caught by multipart limits)
	 *   4. Compute SHA-256 hash of file content
	 *   5. Store file to disk (uploads/{campaignId}/{sourceId}.{ext})
	 *   6. Create source record via sourceService
	 *   7. Return { source } JSON with status 'pending'
	 */
	app.post<{ Params: { campaignId: string } }>(
		"/api/campaigns/:campaignId/sources/upload",
		async (request, reply) => {
			const { campaignId } = request.params;

			// Basic UUID format check
			const uuidPattern =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			if (!uuidPattern.test(campaignId)) {
				return reply.status(400).send({ error: "Invalid campaignId" });
			}

			let file: Awaited<ReturnType<typeof request.file>>;
			try {
				file = await request.file();
			} catch (err: unknown) {
				// @fastify/multipart errors carry a stable `.code` property —
				// match on that instead of fragile message-string checks.
				const code =
					err instanceof Error
						? (err as Error & { code?: string }).code
						: undefined;
				if (code === "FST_REQ_FILE_TOO_LARGE" || code === "FST_FILES_LIMIT") {
					return reply.status(413).send({ error: "File exceeds 50 MB limit" });
				}
				return reply.status(400).send({ error: "Failed to read file" });
			}

			if (!file) {
				return reply.status(400).send({ error: "No file provided" });
			}

			// Validate MIME type
			const mimeType = file.mimetype.toLowerCase().split(";")[0]?.trim() ?? "";
			if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
				// Drain the stream to avoid connection leaks
				file.file.resume();
				return reply.status(400).send({
					error: `Unsupported file type: ${mimeType}. Accepted: PDF, MD, TXT, DOCX`,
				});
			}

			// Read file content
			const bufferChunks: Buffer[] = [];
			try {
				for await (const chunk of file.file) {
					bufferChunks.push(
						Buffer.isBuffer(chunk)
							? chunk
							: Buffer.from(chunk as string, "utf-8"),
					);
				}
			} catch (err: unknown) {
				const code =
					err instanceof Error
						? (err as Error & { code?: string }).code
						: undefined;
				if (code === "FST_REQ_FILE_TOO_LARGE") {
					return reply.status(413).send({ error: "File exceeds 50 MB limit" });
				}
				throw err;
			}
			const content = Buffer.concat(bufferChunks);

			// Compute SHA-256 hash
			const hash = createHash("sha256").update(content).digest("hex");

			// Create the source record first so we have an ID for the storage key
			const sourceType = mimeToSourceType(mimeType);
			const source = await sourceService.create(db, {
				campaignId,
				name: file.filename,
				type: sourceType,
				mimeType,
				sizeBytes: content.length,
				hash,
			});

			// Store file: uploads/{campaignId}/{sourceId}/{filename}
			const ext = file.filename.includes(".")
				? file.filename.slice(file.filename.lastIndexOf("."))
				: "";
			const storageKey = `${campaignId}/${source.id}${ext}`;
			await storage.saveFile({ storageKey, content });
			await sourceService.setStorageKey(db, source.id, storageKey);

			return reply.send({ source: { ...source, storageKey } });
		},
	);

	/**
	 * POST /api/conversation/:conversationId/stream
	 * SSE endpoint for streaming LLM responses. Uses Server-Sent Events rather
	 * than tRPC subscriptions (avoids WebSocket transport complexity).
	 *
	 * Request body: { campaignId: string, query: string }
	 *
	 * SSE event types:
	 *   - delta:    { text: string }        — incremental text chunk
	 *   - done:     { citations, confidence, usage } — final metadata
	 *   - error:    { message: string }     — error during streaming
	 */
	app.post<{
		Params: { conversationId: string };
		Body: { campaignId: string; query: string };
	}>("/api/conversation/:conversationId/stream", async (request, reply) => {
		const paramsResult = conversationStreamParamsSchema.safeParse(
			request.params,
		);
		if (!paramsResult.success) {
			const msg =
				paramsResult.error.issues[0]?.message ?? "Invalid conversationId";
			return reply.status(400).send({ error: msg });
		}
		const bodyResult = conversationStreamBodySchema.safeParse(request.body);
		if (!bodyResult.success) {
			const msg = bodyResult.error.issues[0]?.message ?? "Invalid body";
			return reply.status(400).send({ error: msg });
		}

		const { conversationId } = paramsResult.data;
		const { campaignId, query } = bodyResult.data;

		// Set SSE headers
		reply.raw.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});

		/** Send an SSE event. */
		const sendEvent = (event: string, data: unknown) => {
			reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
		};

		try {
			const result = await conversationService.chatStream(
				db,
				{ campaignId, conversationId, query },
				(textDelta) => {
					sendEvent("delta", { text: textDelta });
				},
			);

			sendEvent("done", {
				citations: result.citations,
				confidence: result.confidence,
				usage: result.usage,
			});
		} catch (error) {
			const mapped = mapDomainError(error);
			sendEvent("error", { message: mapped.message, code: mapped.code });
		} finally {
			reply.raw.end();
		}
	});

	app.register(fastifyTRPCPlugin, {
		prefix: "/trpc",
		trpcOptions: {
			router: appRouter,
			createContext: createContextFactory(db, storage),
		} satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
	});

	// Drain pending import queue on server startup (fire-and-forget)
	app.addHook("onReady", async () => {
		importService
			.processPendingSources(db, storage)
			.then((count) => {
				if (count > 0) {
					console.log(
						`[import] Processed ${count} pending source(s) on startup.`,
					);
				}
			})
			.catch((err: unknown) => {
				if (pgErrorCode(err) === "42P01") {
					console.error(
						"[import] Startup import queue skipped: database tables missing. Run: pnpm --filter @questlog/server db:migrate (and ensure DATABASE_URL in .env points at that DB).",
					);
					return;
				}
				console.error(
					"[import] Error processing pending sources on startup:",
					err,
				);
			});
	});

	return app;
}
