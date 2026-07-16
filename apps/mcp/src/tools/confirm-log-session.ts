import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chunkText } from "@questlog/server/services/chunking.service.js";
import { embedChunks } from "@questlog/server/services/embedding.service.js";
import { entityService } from "@questlog/server/services/entity.service.js";
import type { EntitySpan } from "@questlog/server/services/entity.service.js";
import { sessionService } from "@questlog/server/services/session.service.js";
import { writeRequestService } from "@questlog/server/services/write-request.service.js";
import { ConfirmLogSessionInput } from "@questlog/shared";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

interface EntityConsolidationEntry {
	entityId: string;
	appendedNote: string;
	attribution: { sessionId: string | null; sessionNumber: number | null };
}

interface LogSessionPayload {
	campaignId: string;
	session: {
		title?: string;
		content: string;
		summary?: string;
		tags?: string[];
		sessionNumber?: number;
		date?: string;
	};
	entityLinks: {
		confirmed: EntitySpan[];
		ambiguous: EntitySpan[];
	};
	entityConsolidation: EntityConsolidationEntry[];
}

export function registerConfirmLogSession(
	server: McpServer,
	{ db, fetchFn }: ToolDeps,
) {
	server.registerTool(
		"confirm_log_session",
		{
			description:
				"Confirm a previously-previewed log_session change-set: creates the session record, links its confirmed entities, chunks + embeds the content, and applies entity consolidation updates, all inside a single transaction.",
			inputSchema: ConfirmLogSessionInput,
		},
		withToolErrors(async ({ token }) => {
			const result = await writeRequestService.confirm(
				db,
				token,
				async (tx, rawPayload) => {
					const { campaignId, session, entityLinks, entityConsolidation } =
						rawPayload as LogSessionPayload;

					const created = await sessionService.create(tx, {
						campaignId,
						title: session.title,
						content: session.content,
					});

					const finalized = await sessionService.finalize(tx, {
						id: created.id,
						title: session.title,
						summary: session.summary,
						tags: session.tags,
						sessionNumber: session.sessionNumber,
						date: session.date ? new Date(session.date) : undefined,
					});

					const linked = await sessionService.linkEntities(
						tx,
						finalized.id,
						entityLinks.confirmed,
					);

					const textChunks = chunkText(session.content, {
						sessionId: finalized.id,
						campaignId,
					});
					await embedChunks(tx, textChunks, { fetchFn });

					const entitiesUpdated: EntityConsolidationEntry[] = [];
					for (const entry of entityConsolidation) {
						await entityService.appendToDescription(
							tx,
							entry.entityId,
							entry.appendedNote,
						);
						entitiesUpdated.push({
							...entry,
							attribution: {
								sessionId: finalized.id,
								sessionNumber: finalized.sessionNumber,
							},
						});
					}

					return {
						session: finalized,
						linkedEntityIds: linked.map((link) => link.entityId),
						chunksCreated: textChunks.length,
						entitiesUpdated,
					};
				},
			);

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
