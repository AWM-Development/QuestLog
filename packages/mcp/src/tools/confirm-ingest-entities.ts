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
		withToolErrors(async ({ token, candidateIndices }) => {
			const result = await writeRequestService.confirm(
				db,
				token,
				async (tx, rawPayload) => {
					const { campaignId, candidates } =
						rawPayload as IngestEntitiesPayload;

					const selected = candidateIndices
						? candidateIndices
								.map((index) => candidates[index])
								.filter((c): c is EntityCandidateProposal => c !== undefined)
						: candidates;

					const entityIds: string[] = [];
					for (const candidate of selected) {
						const entity = await entityService.create(tx, {
							campaignId,
							name: candidate.name,
							type: candidate.entityType,
							description: candidate.description,
						});
						entityIds.push(entity.id);
					}

					return { entityIds };
				},
			);

			return {
				content: [{ type: "text", text: JSON.stringify(result) }],
			};
		}),
	);
}
