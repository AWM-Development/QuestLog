import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { importService } from "@questlog/core/services/import.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { IngestTextInput } from "@questlog/shared";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerIngestText(
	server: McpServer,
	{ db, storage, fetchFn }: ToolDeps,
) {
	server.registerTool(
		"ingest_text",
		{
			description:
				"Create a new knowledge-base source from pasted text or markdown and start processing it (chunking + embedding) in the background. Returns immediately with the source's id and pending status — call get_source_status to check when it's done.",
			inputSchema: IngestTextInput,
		},
		withToolErrors(async ({ campaignId, title, content }) => {
			const source = await sourceService.createFromText(db, {
				campaignId,
				name: title,
				content,
			});

			// Fire-and-forget, same as apps/server/src/server.ts's
			// autoProcessUploads path — embedding can take longer than a single
			// tool-call round trip should block on.
			importService
				.processSource(db, storage, source.id, { embedOptions: { fetchFn } })
				.catch((err: unknown) => {
					console.error(
						`[ingest_text] Error processing source ${source.id}:`,
						err,
					);
				});

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							source: { id: source.id, status: source.status },
						}),
					},
				],
			};
		}),
	);
}
