import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EncounterUtilityInput } from "@questlog/shared";
import { ENCOUNTER_DESCRIPTION } from "../content/tool-descriptions.js";
import { withToolErrors } from "./errors.js";

function hpStatus(newHp: number, max: number): "healthy" | "bloodied" | "down" {
	if (newHp <= 0) return "down";
	if (newHp <= max / 2) return "bloodied";
	return "healthy";
}

/**
 * The one tool with no `ToolDeps` — pure computation, no `db`/`storage`/
 * `llmService` needed (see `Docs/tickets/gated/resolved/G-037-live-encounter-mode.md`
 * § Resolution: live encounter state is memory-only, held in the
 * conversation itself, not this tool). Registered with just `server`,
 * matching `registerHelp`'s no-deps precedent in `server.ts`.
 */
export function registerEncounter(server: McpServer) {
	server.registerTool(
		"encounter",
		{
			description: ENCOUNTER_DESCRIPTION,
			inputSchema: EncounterUtilityInput,
		},
		withToolErrors(async (input) => {
			if (input.action === "roll_initiative") {
				// Array.prototype.sort is a stable sort (guaranteed since
				// ES2019) — ties naturally keep their original input order
				// with no explicit tiebreak needed.
				const combatants = [...input.combatants].sort(
					(a, b) => b.initiative - a.initiative,
				);
				return {
					content: [{ type: "text", text: JSON.stringify({ combatants }) }],
				};
			}

			const newHp = Math.min(
				input.max,
				Math.max(0, input.current + input.delta),
			);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							newHp,
							status: hpStatus(newHp, input.max),
						}),
					},
				],
			};
		}),
	);
}
