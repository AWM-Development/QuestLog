import { useState } from "react";
import { trpc } from "@/lib/trpc.js";
import type {
	DuplicateResolutionAction,
	LocalQueueItem,
	Source,
} from "../types.js";

const ACCEPTED_TYPES = new Set([
	"application/pdf",
	"text/markdown",
	"text/x-markdown",
	"text/plain",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

function fileKey(file: File): string {
	return `${file.name}::${file.size}`;
}

async function computeHash(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Manages the pre-upload local queue: hashing → duplicate check → upload.
 * Once a file successfully uploads, its DB record appears via useSourcePolling.
 */
export function useFileUpload(campaignId: string) {
	const [queue, setQueue] = useState<Map<string, LocalQueueItem>>(new Map());
	const utils = trpc.useUtils();

	function updateItem(key: string, patch: Partial<LocalQueueItem>) {
		setQueue((prev) => {
			const next = new Map(prev);
			const item = next.get(key);
			if (item) next.set(key, { ...item, ...patch });
			return next;
		});
	}

	function removeItem(key: string) {
		setQueue((prev) => {
			const next = new Map(prev);
			next.delete(key);
			return next;
		});
	}

	async function uploadFile(file: File, key: string): Promise<void> {
		// Step 1: Compute SHA-256 hash
		updateItem(key, { state: "hashing" });
		let hash: string;
		try {
			hash = await computeHash(file);
		} catch {
			updateItem(key, { state: "error", errorMessage: "Failed to hash file" });
			return;
		}

		// Step 2: Check for duplicate
		updateItem(key, { state: "checking" });
		let duplicate: Source | null = null;
		try {
			duplicate = await utils.source.checkDuplicate.fetch({
				campaignId,
				hash,
			}) as Source | null;
		} catch {
			// Non-fatal: proceed without duplicate check
		}

		if (duplicate) {
			updateItem(key, { state: "waiting-duplicate", existingSource: duplicate });
			return; // Wait for user to resolve
		}

		// Step 3: Upload
		await doUpload(file, key);
	}

	async function doUpload(file: File, key: string): Promise<void> {
		updateItem(key, { state: "uploading" });

		const apiBase = new URL(import.meta.env.VITE_API_URL).origin;
		const uploadUrl = `${apiBase}/api/campaigns/${campaignId}/sources/upload`;

		const formData = new FormData();
		formData.append("file", file);

		try {
			const response = await fetch(uploadUrl, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const body = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				updateItem(key, {
					state: "error",
					errorMessage: body.error ?? `Upload failed (${response.status})`,
				});
				return;
			}

			// Success: remove from local queue, let DB polling take over
			removeItem(key);
			await utils.source.list.invalidate({ campaignId });
		} catch {
			updateItem(key, { state: "error", errorMessage: "Network error" });
		}
	}

	async function uploadFiles(files: File[]): Promise<void> {
		const validFiles = files.filter((f) => {
			if (!ACCEPTED_TYPES.has(f.type)) return false;
			if (f.size > MAX_SIZE_BYTES) return false;
			return true;
		});

		// Add all files to queue immediately so UI shows them
		setQueue((prev) => {
			const next = new Map(prev);
			for (const file of validFiles) {
				const key = fileKey(file);
				if (!next.has(key)) {
					next.set(key, { key, file, state: "hashing" });
				}
			}
			return next;
		});

		// Process each file (sequential to avoid hammering the server)
		for (const file of validFiles) {
			await uploadFile(file, fileKey(file));
		}
	}

	async function resolveDuplicate(
		item: LocalQueueItem,
		action: DuplicateResolutionAction,
	): Promise<void> {
		const { key, file, existingSource } = item;

		if (action === "skip") {
			removeItem(key);
			return;
		}

		if (action === "replace" && existingSource) {
			// Upload new file, then delete old source
			await doUpload(file, key);
			try {
				await utils.client.source.delete.mutate({ id: existingSource.id });
			} catch {
				// Best-effort — old source will remain but new one is uploaded
			}
			await utils.source.list.invalidate({ campaignId });
			return;
		}

		if (action === "keep_both") {
			await doUpload(file, key);
			return;
		}
	}

	const queueItems = Array.from(queue.values());

	return {
		uploadFiles,
		resolveDuplicate,
		queueItems,
		uploading: queueItems.some(
			(i) =>
				i.state === "hashing" ||
				i.state === "checking" ||
				i.state === "uploading",
		),
	};
}
