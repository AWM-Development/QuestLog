import { type CSSProperties, useState } from "react";
import { IconButton } from "../../../components/IconButton.js";
import {
	chatDrawerSurface,
	chatOverlayScrim,
	chatPillButton,
	chatSearchInput,
} from "../styles.js";
import { ConversationListItem } from "./ConversationListItem.js";

interface Conversation {
	id: string;
	title: string | null;
	tags: string[];
	status: string;
	updatedAt: Date;
}

interface ConversationDrawerProps {
	conversations: Conversation[];
	activeConversationId: string | null;
	isTablet: boolean;
	onSelect: (id: string) => void;
	onCreate: () => void;
	onArchive: (id: string) => void;
	onEditTitle: (id: string, title: string) => void;
	onClose: () => void;
	pendingArchiveId: string | null;
	onUndoArchive: (id: string) => void;
}

const overlayDrawerStyle: CSSProperties = {
	...chatDrawerSurface,
	position: "fixed",
	top: 0,
	left: 56,
	bottom: 0,
	zIndex: 20,
	animation: "drawer-in 200ms ease",
};

const drawerStyle: CSSProperties = chatDrawerSurface;

const scrimStyle: CSSProperties = { ...chatOverlayScrim, left: 56 };

const headerStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "var(--space-3) var(--space-3) var(--space-2)",
};

const labelStyle: CSSProperties = {
	fontSize: "11px",
	textTransform: "uppercase",
	letterSpacing: "0.06em",
	color: "var(--text-dim)",
	fontWeight: 500,
};

const searchInputStyle: CSSProperties = {
	...chatSearchInput,
	margin: "0 var(--space-3) var(--space-2)",
};

const listStyle: CSSProperties = {
	flex: 1,
	overflowY: "auto",
	padding: "0 var(--space-2)",
	display: "flex",
	flexDirection: "column",
	gap: "2px",
};

const toastStyle: CSSProperties = {
	padding: "var(--space-2) var(--space-3)",
	margin: "var(--space-2) var(--space-3)",
	borderRadius: "var(--r-sm)",
	background: "var(--bg-elevated)",
	border: "0.5px solid var(--border)",
	fontSize: "11px",
	color: "var(--text-secondary)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	animation: "msg-in 150ms ease",
};

export function ConversationDrawer({
	conversations,
	activeConversationId,
	isTablet,
	onSelect,
	onCreate,
	onArchive,
	onEditTitle,
	onClose,
	pendingArchiveId,
	onUndoArchive,
}: ConversationDrawerProps) {
	const [search, setSearch] = useState("");

	const filtered = conversations.filter((c) => {
		if (!search.trim()) return true;
		const q = search.toLowerCase();
		return (
			(c.title ?? "").toLowerCase().includes(q) ||
			c.tags.some((t) => t.toLowerCase().includes(q))
		);
	});

	const drawerContent = (
		<div style={isTablet ? overlayDrawerStyle : drawerStyle}>
			<div style={headerStyle}>
				<span style={labelStyle}>Conversations</span>
				<IconButton
					label="New conversation"
					size={24}
					active
					onClick={onCreate}
				>
					+
				</IconButton>
			</div>

			<input
				type="text"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				placeholder="Search conversations..."
				style={searchInputStyle}
			/>

			<div style={listStyle}>
				{filtered.length === 0 ? (
					<div
						style={{
							fontSize: "11px",
							color: "var(--text-dim)",
							fontStyle: "italic",
							padding: "var(--space-3) var(--space-1)",
							textAlign: "center",
						}}
					>
						{search.trim()
							? "No matching conversations"
							: "No conversations yet. Start one with the + button above."}
					</div>
				) : (
					filtered.map((conversation) => (
						<ConversationListItem
							key={conversation.id}
							conversation={conversation}
							isActive={conversation.id === activeConversationId}
							onSelect={(id) => {
								onSelect(id);
								if (isTablet) onClose();
							}}
							onArchive={onArchive}
							onEditTitle={onEditTitle}
						/>
					))
				)}
			</div>

			{pendingArchiveId && (
				<div style={toastStyle}>
					<span>Conversation archived</span>
					<button
						type="button"
						style={{
							...chatPillButton,
							padding: "2px 6px",
							color: "var(--accent)",
							fontSize: "11px",
						}}
						onClick={() => onUndoArchive(pendingArchiveId)}
					>
						Undo
					</button>
				</div>
			)}
		</div>
	);

	if (isTablet) {
		return (
			<>
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: scrim is aria-hidden, not keyboard-interactive */}
				<div style={scrimStyle} onClick={onClose} aria-hidden="true" />
				{drawerContent}
			</>
		);
	}

	return drawerContent;
}
