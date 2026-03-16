import type { SourceStatus } from "@questlog/shared";

/**
 * Source shape returned by trpc.source.list.
 * Mirrors the DB row with superjson Date deserialization.
 */
export interface Source {
	id: string;
	campaignId: string;
	name: string;
	type: string;
	mimeType: string | null;
	sizeBytes: number | null;
	hash: string | null;
	status: SourceStatus;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * A file queued for upload in the browser before it has a DB record.
 * Tracked by useFileUpload in local state.
 */
export interface LocalQueueItem {
	/** Stable key: `${filename}::${size}` */
	key: string;
	file: File;
	state: "hashing" | "checking" | "waiting-duplicate" | "uploading" | "error";
	/** Set when state === 'waiting-duplicate' */
	existingSource?: Source;
	errorMessage?: string;
}

export type DuplicateResolutionAction = "replace" | "keep_both" | "skip";
