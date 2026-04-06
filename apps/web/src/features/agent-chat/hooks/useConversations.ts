import { useCallback, useRef, useState } from "react";
import { trpc } from "../../../lib/trpc.js";

interface UseConversationsReturn {
	conversations: Array<{
		id: string;
		title: string | null;
		tags: string[];
		status: string;
		updatedAt: Date;
		createdAt: Date;
		campaignId: string;
	}>;
	isLoading: boolean;
	createConversation: () => Promise<string>;
	archiveConversation: (id: string) => void;
	undoArchive: (id: string) => void;
	updateTitle: (id: string, title: string) => Promise<void>;
	updateTags: (id: string, tags: string[]) => Promise<void>;
	pendingArchiveId: string | null;
}

export function useConversations(campaignId: string): UseConversationsReturn {
	const utils = trpc.useUtils();

	const listQuery = trpc.conversation.list.useQuery(
		{ campaignId, status: "active" },
		{ enabled: !!campaignId },
	);

	const createMutation = trpc.conversation.create.useMutation({
		onSuccess: () => {
			utils.conversation.list.invalidate({ campaignId });
		},
	});

	const updateMutation = trpc.conversation.update.useMutation({
		onSuccess: () => {
			utils.conversation.list.invalidate({ campaignId });
		},
	});

	// Archive with undo
	const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
	const archiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const createConversation = useCallback(async () => {
		const result = await createMutation.mutateAsync({ campaignId });
		return result.id;
	}, [campaignId, createMutation]);

	const archiveConversation = useCallback(
		(id: string) => {
			setPendingArchiveId(id);
			// Clear any existing timer
			if (archiveTimer.current) clearTimeout(archiveTimer.current);
			// Commit after 5 seconds
			archiveTimer.current = setTimeout(() => {
				updateMutation.mutate({ id, status: "archived" });
				setPendingArchiveId(null);
			}, 5000);
		},
		[updateMutation],
	);

	const undoArchive = useCallback(
		(id: string) => {
			if (pendingArchiveId === id && archiveTimer.current) {
				clearTimeout(archiveTimer.current);
				archiveTimer.current = null;
				setPendingArchiveId(null);
			}
		},
		[pendingArchiveId],
	);

	const updateTitle = useCallback(
		async (id: string, title: string) => {
			await updateMutation.mutateAsync({ id, title });
		},
		[updateMutation],
	);

	const updateTags = useCallback(
		async (id: string, tags: string[]) => {
			await updateMutation.mutateAsync({ id, tags });
		},
		[updateMutation],
	);

	// Filter out pending archive from displayed list
	const conversations = (listQuery.data ?? []).filter(
		(c) => c.id !== pendingArchiveId,
	);

	return {
		conversations: conversations as UseConversationsReturn["conversations"],
		isLoading: listQuery.isLoading,
		createConversation,
		archiveConversation,
		undoArchive,
		updateTitle,
		updateTags,
		pendingArchiveId,
	};
}
