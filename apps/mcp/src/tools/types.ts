import type { Database } from "@questlog/server/db/index.js";
import type { FetchFn } from "@questlog/server/services/voyage.client.js";

export interface ToolDeps {
	db: Database;
	/** Override fetch for testing (passed through to context assembly's search). */
	fetchFn?: FetchFn;
}
