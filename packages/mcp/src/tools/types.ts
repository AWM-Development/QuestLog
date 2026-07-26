import type { Database } from "@questlog/core/db/index.js";
import type { StorageProvider } from "@questlog/core/services/storage.service.js";
import type { FetchFn } from "@questlog/core/services/voyage.client.js";

export interface ToolDeps {
	db: Database;
	/** Override fetch for testing (passed through to context assembly's search). */
	fetchFn?: FetchFn;
	/** Backing store for uploaded/imported source content (passed through to `importService.processSource`). */
	storage: StorageProvider;
}
