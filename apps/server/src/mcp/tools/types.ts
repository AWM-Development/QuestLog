import type { Database } from "../../db/index.js";
import type { FetchFn } from "../../services/voyage.client.js";

export interface ToolDeps {
	db: Database;
	/** Override fetch for testing (passed through to context assembly's search). */
	fetchFn?: FetchFn;
}
