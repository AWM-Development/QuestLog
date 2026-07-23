import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { NotFoundError } from "../../lib/errors.js";

/**
 * Wraps a tool handler so a thrown `NotFoundError` becomes the structured
 * `{ isError: true, content: [...] }` shape required by `.claude/rules/mcp.md`
 * instead of an exception that kills the MCP connection. Any other error
 * rethrows unchanged.
 */
export function withToolErrors<Args extends unknown[]>(
	handler: (...args: Args) => Promise<CallToolResult>,
): (...args: Args) => Promise<CallToolResult> {
	return async (...args: Args) => {
		try {
			return await handler(...args);
		} catch (error) {
			if (error instanceof NotFoundError) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: JSON.stringify({
								error: { code: "NOT_FOUND", message: error.message },
							}),
						},
					],
				};
			}
			throw error;
		}
	};
}
