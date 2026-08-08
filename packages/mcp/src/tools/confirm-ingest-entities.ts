import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entityService } from "@questlog/core/services/entity.service.js";
import type { EntityCandidateProposal } from "@questlog/core/services/entity.service.js";
import { writeRequestService } from "@questlog/core/services/write-request.service.js";
import { ConfirmIngestEntitiesInput } from "@questlog/shared";
import { CONFIRM_INGEST_ENTITIES_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";
import type { ToolDeps } from "./types.js";

interface IngestEntitiesPayload {
	campaignId: string;
	sourceId: string;
	candidates: EntityCandidateProposal[];
}

export function registerConfirmIngestEntities(
	server: McpServer,
	{ db }: ToolDeps,
) {
	server.registerTool(
		"confirm_ingest_entities",
		{
			description: CONFIRM_INGEST_ENTITIES_DESCRIPTION,
			inputSchema: ConfirmIngestEntitiesInput,
		},
		withToolErrors(async ({ token, candidateIndices, entityTypeOverrides }) => {
			const result = await writeRequestService.confirm(
				db,
				token,
				async (tx, rawPayload) => {
					const { campaignId, sourceId, candidates } =
						rawPayload as IngestEntitiesPayload;

					const indices =
						candidateIndices ?? candidates.map((_, index) => index);

					const entityIds: string[] = [];
					const rejected: Array<{ index: number; reason: string }> = [];

					for (const index of indices) {
						const candidate = candidates[index];
						if (!candidate) continue;

						// Per-candidate rejection, not batch-level — see IMPLEMENTATION_NOTES.md § G-021 (T-119).
						let entityType: string = candidate.entityType;
						if (candidate.entityType === "unclassified") {
							const override = entityTypeOverrides?.[String(index)];
							if (!override) {
								rejected.push({
									index,
									reason:
										"unclassified candidate requires an entityType override",
								});
								continue;
							}
							entityType = override;
						}

						const entity = await entityService.create(tx, {
							campaignId,
							name: candidate.name,
							type: entityType,
							description: candidate.description,
							sourceId,
							attributes: { extractedFrom: sourceId },
						});
						entityIds.push(entity.id);
					}

					return { entityIds, rejected };
				},
			);

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
