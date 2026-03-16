/**
 * Pluggable storage for uploaded import files.
 * Local filesystem implementation now; swap for S3/GCS in a later milestone.
 */

import fs from "node:fs/promises";
import path from "node:path";

export interface SaveFileParams {
	/** Logical key for later retrieval (e.g. campaignId/sourceId/filename) */
	storageKey: string;
	content: Buffer;
}

export interface StorageProvider {
	saveFile(params: SaveFileParams): Promise<{ storageKey: string }>;
	getFileBuffer(storageKey: string): Promise<Buffer>;
	deleteFile(storageKey: string): Promise<void>;
}

export interface LocalFilesystemStorageOptions {
	/** Base directory for uploads (e.g. uploads/ or path from env). */
	basePath: string;
}

/** In-memory storage for tests. */
export function createMemoryStorage(): StorageProvider {
	const store = new Map<string, Buffer>();
	return {
		async saveFile(params: SaveFileParams): Promise<{ storageKey: string }> {
			store.set(params.storageKey, params.content);
			return { storageKey: params.storageKey };
		},
		async getFileBuffer(storageKey: string): Promise<Buffer> {
			const buf = store.get(storageKey);
			if (buf === undefined) throw new Error(`Not found: ${storageKey}`);
			return buf;
		},
		async deleteFile(storageKey: string): Promise<void> {
			store.delete(storageKey);
		},
	};
}

/**
 * Writes files under basePath. storageKey is used as relative path (slashes allowed).
 * Caller must ensure storageKey is safe (no path traversal).
 */
export function createLocalFilesystemStorage(
	options: LocalFilesystemStorageOptions,
): StorageProvider {
	const { basePath } = options;

	return {
		async saveFile(params: SaveFileParams): Promise<{ storageKey: string }> {
			const fullPath = path.join(basePath, params.storageKey);
			await fs.mkdir(path.dirname(fullPath), { recursive: true });
			await fs.writeFile(fullPath, params.content);
			return { storageKey: params.storageKey };
		},

		async getFileBuffer(storageKey: string): Promise<Buffer> {
			const fullPath = path.join(basePath, storageKey);
			return fs.readFile(fullPath);
		},

		async deleteFile(storageKey: string): Promise<void> {
			const fullPath = path.join(basePath, storageKey);
			await fs.rm(fullPath, { force: true });
		},
	};
}
