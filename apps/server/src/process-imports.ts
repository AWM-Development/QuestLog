/**
 * Worker entrypoint: process pending import sources (text extraction).
 * Run via: pnpm run process-imports
 */
import "dotenv/config";
import { db } from "./db/index.js";
import { importService } from "./services/import.service.js";
import { createLocalFilesystemStorage } from "./services/storage.service.js";

const storage = createLocalFilesystemStorage({
	basePath: process.env.UPLOAD_PATH ?? "uploads",
});

const limit = Number(process.env.IMPORT_PROCESS_LIMIT) || 50;
const count = await importService.processPendingSources(db, storage, limit);
console.log(`Processed ${count} pending source(s).`);
process.exit(0);
