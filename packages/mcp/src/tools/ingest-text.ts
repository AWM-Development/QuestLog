import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { campaignService } from "@questlog/core/services/campaign.service.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import { importService } from "@questlog/core/services/import.service.js";
import { sourceService } from "@questlog/core/services/source.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { IngestTextInput } from "@questlog/shared";
import { INGEST_TEXT_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

export function registerIngestText(
	server: McpServer,
	{ db, storage, fetchFn }: ToolDeps,
) {
	server.registerTool(
		"ingest_text",
		{
			description: INGEST_TEXT_DESCRIPTION,
			inputSchema: IngestTextInput,
		},
		withToolErrors(
			async ({
				campaignId,
				newCampaign,
				title,
				content,
				sourceId,
				final = true,
			}) => {
				const resolvedCampaignId = newCampaign
					? (await campaignService.create(db, newCampaign)).id
					: (campaignId as string);

				const source = sourceId
					? await (async () => {
							// appendContent takes a bare sourceId (no campaignId param,
							// per its ticket-specified signature) — validate ownership
							// here first so a sourceId from another campaign 404s
							// instead of silently appending.
							await sourceService.getByIdForCampaign(
								db,
								resolvedCampaignId,
								sourceId,
							);
							return sourceService.appendContent(db, sourceId, content);
						})()
					: await sourceService.createFromText(db, {
							campaignId: resolvedCampaignId,
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

				const candidates = await entityService.detectCandidates(db, {
					campaignId: resolvedCampaignId,
					text: content,
				});
				const entityCandidates = candidates.length
					? {
							token: (
								await writeRequestService.createPreview(db, {
									campaignId: resolvedCampaignId,
									toolName: "ingest_entities",
									payload: {
										campaignId: resolvedCampaignId,
										sourceId: source.id,
										candidates,
									},
								})
							).token,
							candidates,
						}
					: null;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								campaign: newCampaign ? { id: resolvedCampaignId } : undefined,
								source: { id: source.id, status: source.status },
								entityCandidates,
							}),
						},
					],
				};
			},
		),
	);
}
