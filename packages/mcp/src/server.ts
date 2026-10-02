import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ONBOARDING_INSTRUCTIONS } from "./content/onboarding-instructions.js";
import { registerAddItem } from "./tools/add-item.js";
import { registerAdjustWealth } from "./tools/adjust-wealth.js";
import { registerAppendEntityNote } from "./tools/append-entity-note.js";
import { registerArchiveEntity } from "./tools/archive-entity.js";
import { registerBorrowEntity } from "./tools/borrow-entity.js";
import { registerConfirmArchiveEntity } from "./tools/confirm-archive-entity.js";
import { registerConfirmCorrectLore } from "./tools/confirm-correct-lore.js";
import { registerConfirmIngestEntities } from "./tools/confirm-ingest-entities.js";
import { registerConfirmLogSession } from "./tools/confirm-log-session.js";
import { registerConfirmUnarchiveEntity } from "./tools/confirm-unarchive-entity.js";
import { registerConfirmUpdateEntity } from "./tools/confirm-update-entity.js";
import { registerCorrectLore } from "./tools/correct-lore.js";
import { registerCreateCampaign } from "./tools/create-campaign.js";
import { registerCreateEntity } from "./tools/create-entity.js";
import { registerDetectContradictions } from "./tools/detect-contradictions.js";
import { registerEncounter } from "./tools/encounter.js";
import { registerGetChunkHistory } from "./tools/get-chunk-history.js";
import { registerGetEncounter } from "./tools/get-encounter.js";
import { registerGetEntity } from "./tools/get-entity.js";
import { registerGetSourceStatus } from "./tools/get-source-status.js";
import { registerHelp } from "./tools/help.js";
import { registerIngestText } from "./tools/ingest-text.js";
import { registerListCampaigns } from "./tools/list-campaigns.js";
import { registerListEncounters } from "./tools/list-encounters.js";
import { registerListEntities } from "./tools/list-entities.js";
import { registerListInventory } from "./tools/list-inventory.js";
import { registerListSources } from "./tools/list-sources.js";
import { registerLogSession } from "./tools/log-session.js";
import { registerPrepBrief } from "./tools/prep-brief.js";
import { registerQueryLore } from "./tools/query-lore.js";
import { registerSaveEncounter } from "./tools/save-encounter.js";
import { registerTransferItem } from "./tools/transfer-item.js";
import type { ToolDeps } from "./tools/types.js";
import { registerUnarchiveEntity } from "./tools/unarchive-entity.js";
import { registerUpdateEntity } from "./tools/update-entity.js";

export type CreateMcpServerOptions = ToolDeps;

export function createMcpServer(deps: CreateMcpServerOptions): McpServer {
	const server = new McpServer(
		{ name: "questlog-mcp", version: "0.0.0" },
		{ instructions: ONBOARDING_INSTRUCTIONS },
	);

	registerQueryLore(server, deps);
	registerPrepBrief(server, deps);
	registerListCampaigns(server, deps);
	registerCreateCampaign(server, deps);
	registerListEntities(server, deps);
	registerGetEntity(server, deps);
	registerCreateEntity(server, deps);
	registerAppendEntityNote(server, deps);
	registerUpdateEntity(server, deps);
	registerConfirmUpdateEntity(server, deps);
	registerArchiveEntity(server, deps);
	registerConfirmArchiveEntity(server, deps);
	registerUnarchiveEntity(server, deps);
	registerConfirmUnarchiveEntity(server, deps);
	registerLogSession(server, deps);
	registerConfirmLogSession(server, deps);
	registerIngestText(server, deps);
	registerConfirmIngestEntities(server, deps);
	registerGetSourceStatus(server, deps);
	registerListSources(server, deps);
	registerCorrectLore(server, deps);
	registerConfirmCorrectLore(server, deps);
	registerGetChunkHistory(server, deps);
	registerDetectContradictions(server, deps);
	registerAddItem(server, deps);
	registerTransferItem(server, deps);
	registerAdjustWealth(server, deps);
	registerListInventory(server, deps);
	registerSaveEncounter(server, deps);
	registerListEncounters(server, deps);
	registerGetEncounter(server, deps);
	registerBorrowEntity(server, deps);
	registerEncounter(server);
	registerHelp(server);

	return server;
}
