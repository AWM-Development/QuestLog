import {
	type CSSProperties,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "../../../lib/trpc.js";
import { useChat } from "../hooks/useChat.js";
import { useConversations } from "../hooks/useConversations.js";
import { useLocalStorage } from "../hooks/useLocalStorage.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { ChatHeader } from "./ChatHeader.js";
import { ChatInput } from "./ChatInput.js";
import { ContextPanel } from "./ContextPanel.js";
import { ConversationDrawer } from "./ConversationDrawer.js";
import { MessageList } from "./MessageList.js";

const chatPageStyle: CSSProperties = {
	display: "flex",
	flexDirection: "row",
	height: "100%",
	overflow: "hidden",
};

const chatMainStyle: CSSProperties = {
	flex: 1,
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
	minWidth: 0,
};

export function ChatPage() {
	const { id: campaignId, conversationId } = useParams<{
		id: string;
		conversationId?: string;
	}>();
	const navigate = useNavigate();
	const isTablet = useMediaQuery("(max-width: 1199px)");

	const [drawerOpen, setDrawerOpen] = useLocalStorage(
		"questlog-drawer-open",
		false,
	);
	const [panelOpen, setPanelOpen] = useLocalStorage(
		"questlog-panel-open",
		false,
	);
	const [starterFill, setStarterFill] = useState<string | undefined>(
		undefined,
	);
	const pendingMessageRef = useRef<string | null>(null);
	const creatingRef = useRef(false);

	// Auto-close drawer when crossing to tablet breakpoint
	useEffect(() => {
		if (isTablet && drawerOpen) {
			setDrawerOpen(false);
		}
	}, [isTablet]); // eslint-disable-line react-hooks/exhaustive-deps -- only on breakpoint change

	// Campaign data
	const campaignQuery = trpc.campaign.getById.useQuery(
		{ id: campaignId ?? "" },
		{ enabled: !!campaignId },
	);

	// Conversations
	const {
		conversations,
		createConversation,
		archiveConversation,
		undoArchive,
		updateTitle,
		updateTags,
		pendingArchiveId,
	} = useConversations(campaignId ?? "");

	// Chat
	const {
		messages,
		sendMessage,
		isLoading: chatLoading,
		isStreaming,
		error,
		retry,
	} = useChat(campaignId ?? "", conversationId);

	// Send pending message after auto-create navigates to new conversation
	useEffect(() => {
		if (conversationId && pendingMessageRef.current) {
			const msg = pendingMessageRef.current;
			pendingMessageRef.current = null;
			sendMessage(msg);
		}
	}, [conversationId, sendMessage]);

	// Extract all unique tags across conversations for tag suggestions
	const allTags = useMemo(() => {
		const tagSet = new Set<string>();
		for (const c of conversations) {
			for (const t of c.tags) tagSet.add(t);
		}
		return Array.from(tagSet).sort();
	}, [conversations]);

	// Active conversation data
	const activeConversation = conversations.find(
		(c) => c.id === conversationId,
	);

	// Extract sources from agent messages for the context panel
	const panelSources = useMemo(() => {
		return messages
			.filter((m) => m.role === "assistant" && m.sources)
			.flatMap((m) => m.sources ?? []);
	}, [messages]);

	// Handlers
	const handleSelectConversation = useCallback(
		(id: string) => {
			navigate(`/campaign/${campaignId}/chat/${id}`);
		},
		[navigate, campaignId],
	);

	const handleCreateConversation = useCallback(async () => {
		if (creatingRef.current) return;
		creatingRef.current = true;
		try {
			const id = await createConversation();
			navigate(`/campaign/${campaignId}/chat/${id}`);
		} finally {
			creatingRef.current = false;
		}
	}, [createConversation, navigate, campaignId]);

	const handleSend = useCallback(
		async (query: string) => {
			if (!conversationId) {
				// Queue message to send after navigation
				pendingMessageRef.current = query;
				await handleCreateConversation();
				return;
			}
			setStarterFill(undefined);
			await sendMessage(query);
		},
		[conversationId, sendMessage, handleCreateConversation],
	);

	const handleEditTitle = useCallback(
		(title: string) => {
			if (conversationId) updateTitle(conversationId, title);
		},
		[conversationId, updateTitle],
	);

	const handleUpdateTags = useCallback(
		(tags: string[]) => {
			if (conversationId) updateTags(conversationId, tags);
		},
		[conversationId, updateTags],
	);

	const handleClosePanel = useCallback(() => {
		setPanelOpen(false);
	}, [setPanelOpen]);

	return (
		<div style={chatPageStyle}>
			{drawerOpen && (
				<ConversationDrawer
					conversations={conversations}
					activeConversationId={conversationId ?? null}
					isTablet={isTablet}
					onSelect={handleSelectConversation}
					onCreate={handleCreateConversation}
					onArchive={archiveConversation}
					onEditTitle={(id, title) => updateTitle(id, title)}
					onClose={() => setDrawerOpen(false)}
					pendingArchiveId={pendingArchiveId}
					onUndoArchive={undoArchive}
				/>
			)}

			<div style={chatMainStyle}>
				<ChatHeader
					campaignName={campaignQuery.data?.name}
					conversationTitle={activeConversation?.title ?? null}
					conversationTags={activeConversation?.tags ?? []}
					allTags={allTags}
					drawerOpen={drawerOpen}
					panelOpen={panelOpen}
					onToggleDrawer={() => setDrawerOpen(!drawerOpen)}
					onTogglePanel={() => setPanelOpen(!panelOpen)}
					onEditTitle={handleEditTitle}
					onUpdateTags={handleUpdateTags}
				/>

				<MessageList
					messages={messages}
					isLoading={chatLoading && messages.length === 0}
					error={error}
					onRetry={retry}
					onStarterClick={setStarterFill}
					hasConversation={!!conversationId}
				/>

				<ChatInput
					onSend={handleSend}
					disabled={isStreaming || (chatLoading && !!conversationId)}
					onStarterFill={starterFill}
				/>
			</div>

			{panelOpen && (
				<ContextPanel
					sources={panelSources}
					onClose={handleClosePanel}
					isOverlay={isTablet}
				/>
			)}
		</div>
	);
}
