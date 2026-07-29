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
				"Create a new knowledge-base source from text or markdown and start processing it (chunking + embedding) in the background. Returns immediately with the source's id and pending status. " +
				"If the user attaches a document (PDF/DOCX/image) to the conversation, extract its text yourself and call this tool directly - do not ask the user to paste it manually. " +
				"If writing out the extracted text yourself would take more than roughly a page or two of your own response, don't put it all in one call: split it across multiple calls instead, passing the first call's returned source.id as sourceId on each subsequent call and final: false until the last chunk (final: true, the default, on the last one) so processing only starts once. " +
				"After the final chunk, proactively call get_source_status to check progress and narrate it to the user.",
			inputSchema: IngestTextInput,
		},
		withToolErrors(
			async ({ campaignId, title, content, sourceId, final = true }) => {
				const source = sourceId
					? await (async () => {
							// appendContent takes a bare sourceId (no campaignId param,
							// per its ticket-specified signature) — validate ownership
							// here first so a sourceId from another campaign 404s
							// instead of silently appending.
							await sourceService.getByIdForCampaign(db, campaignId, sourceId);
							return sourceService.appendContent(db, sourceId, content);
						})()
					: await sourceService.createFromText(db, {
							campaignId,
							name: title,
							content,
						});

				if (final) {
					// Fire-and-forget, same as apps/server/src/server.ts's
					// autoProcessUploads path - embedding can take longer than a
					// single tool-call round trip should block on.
					importService
						.processSource(db, storage, source.id, {
							embedOptions: { fetchFn },
						})
						.catch((err: unknown) => {
							console.error(
								`[ingest_text] Error processing source ${source.id}:`,
								err,
							);
						});
				}

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
			},
		),
	);
}
