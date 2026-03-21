import { type CSSProperties, useState } from "react";
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

const drawerStyle: CSSProperties = {
	width: 240,
	background: "var(--bg-surface)",
	borderRight: "0.5px solid var(--border)",
	display: "flex",
	flexDirection: "column",
	height: "100%",
	overflow: "hidden",
	flexShrink: 0,
};

const overlayDrawerStyle: CSSProperties = {
	...drawerStyle,
	position: "fixed",
	top: 0,
	left: 56,
	bottom: 0,
	zIndex: 20,
	animation: "drawer-in 200ms ease",
};

const scrimStyle: CSSProperties = {
	position: "fixed",
	inset: 0,
	left: 56,
	zIndex: 19,
	background: "rgba(9,13,18,0.5)",
	animation: "scrim-in 150ms ease",
};

const headerStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "14px 12px 8px",
};

const labelStyle: CSSProperties = {
	fontSize: "11px",
	textTransform: "uppercase",
	letterSpacing: "0.5px",
	color: "var(--text-dim)",
	fontWeight: 500,
};

const newBtnStyle: CSSProperties = {
	width: 24,
	height: 24,
	borderRadius: "var(--r-sm)",
	border: "none",
	background: "var(--accent-muted)",
	color: "var(--accent)",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: "14px",
	transition: "all 150ms ease",
};

const searchInputStyle: CSSProperties = {
	margin: "0 12px 8px",
	padding: "6px 10px",
	background: "var(--bg-elevated)",
	border: "1px solid var(--border)",
	borderRadius: "var(--r-sm)",
	fontSize: "11px",
	color: "var(--text-primary)",
	outline: "none",
	fontFamily: "var(--font-body)",
};

const listStyle: CSSProperties = {
	flex: 1,
	overflowY: "auto",
	padding: "0 8px",
	display: "flex",
	flexDirection: "column",
	gap: "2px",
};

const toastStyle: CSSProperties = {
	padding: "8px 12px",
	margin: "8px 12px",
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
				<button
					type="button"
					style={newBtnStyle}
					onClick={onCreate}
					aria-label="New conversation"
				>
					+
				</button>
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
							padding: "12px 4px",
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
							background: "none",
							border: "none",
							color: "var(--accent)",
							cursor: "pointer",
							fontSize: "11px",
							fontFamily: "var(--font-body)",
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
