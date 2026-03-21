import { type CSSProperties, useState } from "react";
import { ConversationTags } from "./ConversationTags.js";

interface ChatHeaderProps {
	campaignName?: string;
	conversationTitle: string | null;
	conversationTags: string[];
	allTags: string[];
	drawerOpen: boolean;
	panelOpen: boolean;
	onToggleDrawer: () => void;
	onTogglePanel: () => void;
	onEditTitle: (title: string) => void;
	onUpdateTags: (tags: string[]) => void;
}

const headerStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "10px",
	padding: "10px 20px",
	borderBottom: "0.5px solid var(--border-subtle)",
	flexShrink: 0,
	minHeight: "48px",
	overflow: "hidden",
};

const toggleBtnStyle: CSSProperties = {
	width: 28,
	height: 28,
	borderRadius: "var(--r-sm)",
	border: "none",
	background: "transparent",
	color: "var(--text-muted)",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: "14px",
	transition: "all 150ms ease",
	flexShrink: 0,
};

const campaignBadgeStyle: CSSProperties = {
	padding: "3px 10px",
	borderRadius: "var(--r-pill)",
	background: "var(--accent-muted)",
	border: "0.5px solid var(--ent-npc-border)",
	fontSize: "11px",
	fontWeight: 500,
	color: "var(--accent)",
	flexShrink: 0,
};

const titleStyle: CSSProperties = {
	fontFamily: "var(--font-display)",
	fontSize: "17px",
	fontWeight: 600,
	color: "var(--text-primary)",
	margin: 0,
	cursor: "pointer",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	minWidth: 0,
};

const headerBtnStyle: CSSProperties = {
	padding: "5px 10px",
	borderRadius: "var(--r-sm)",
	border: "0.5px solid var(--border)",
	background: "transparent",
	color: "var(--text-muted)",
	fontSize: "12px",
	cursor: "pointer",
	fontFamily: "var(--font-body)",
	transition: "all 150ms ease",
	flexShrink: 0,
	whiteSpace: "nowrap",
};

const headerBtnHoverStyle: CSSProperties = {
	color: "var(--text-secondary)",
	borderColor: "var(--border-hover)",
};

const panelActiveStyle: CSSProperties = {
	color: "var(--accent)",
	borderColor: "var(--ent-npc-border)",
	background: "var(--accent-muted)",
};

const searchStyle: CSSProperties = {
	padding: "5px 10px",
	borderRadius: "var(--r-sm)",
	border: "0.5px solid var(--border)",
	background: "var(--bg-elevated)",
	color: "var(--text-dim)",
	fontSize: "11px",
	cursor: "pointer",
	fontFamily: "var(--font-body)",
	flexShrink: 0,
	display: "flex",
	alignItems: "center",
	gap: "6px",
	whiteSpace: "nowrap",
};

function HeaderButton({
	children,
	onClick,
	active,
}: {
	children: React.ReactNode;
	onClick?: () => void;
	active?: boolean;
}) {
	const [hovered, setHovered] = useState(false);
	return (
		<button
			type="button"
			style={{
				...headerBtnStyle,
				...(active ? panelActiveStyle : {}),
				...(!active && hovered ? headerBtnHoverStyle : {}),
			}}
			onClick={onClick}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{children}
		</button>
	);
}

export function ChatHeader({
	campaignName,
	conversationTitle,
	conversationTags,
	allTags,
	drawerOpen,
	panelOpen,
	onToggleDrawer,
	onTogglePanel,
	onEditTitle,
	onUpdateTags,
}: ChatHeaderProps) {
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleValue, setTitleValue] = useState(conversationTitle ?? "");

	const handleTitleSave = () => {
		const trimmed = titleValue.trim();
		if (trimmed && trimmed !== conversationTitle) {
			onEditTitle(trimmed);
		}
		setEditingTitle(false);
	};

	return (
		<div style={headerStyle}>
			<button
				type="button"
				style={toggleBtnStyle}
				onClick={onToggleDrawer}
				aria-label={drawerOpen ? "Close drawer" : "Open drawer"}
			>
				&#x2630;
			</button>

			{campaignName && <span style={campaignBadgeStyle}>{campaignName}</span>}

			{editingTitle ? (
				<input
					type="text"
					value={titleValue}
					onChange={(e) => setTitleValue(e.target.value)}
					onBlur={handleTitleSave}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleTitleSave();
						if (e.key === "Escape") setEditingTitle(false);
					}}
					// biome-ignore lint/a11y/noAutofocus: title edit should focus immediately
					autoFocus
					style={{
						...titleStyle,
						background: "var(--bg-elevated)",
						border: "1px solid var(--border-hover)",
						borderRadius: "var(--r-sm)",
						padding: "2px 8px",
						outline: "none",
						flex: "0 1 auto",
						minWidth: "120px",
					}}
				/>
			) : (
				<button
					type="button"
					style={{
						...titleStyle,
						background: "none",
						border: "none",
						padding: 0,
						textAlign: "left",
						flex: "0 1 auto",
						...(conversationTitle
							? {}
							: {
									fontStyle: "italic",
									color: "var(--text-muted)",
								}),
					}}
					onClick={() => {
						setTitleValue(conversationTitle ?? "");
						setEditingTitle(true);
					}}
				>
					{conversationTitle || "New conversation"}
				</button>
			)}

			<ConversationTags
				tags={conversationTags}
				allTags={allTags}
				onUpdateTags={onUpdateTags}
			/>

			<div style={{ flex: 1, minWidth: 0 }} />

			<span style={searchStyle}>
				&#x1F50D; Search...{" "}
				<kbd
					style={{
						fontSize: "10px",
						padding: "1px 4px",
						borderRadius: "3px",
						border: "0.5px solid var(--border)",
						background: "var(--bg-surface)",
					}}
				>
					&#x2318;K
				</kbd>
			</span>

			<HeaderButton>&#x1F4DD; Notes</HeaderButton>

			<HeaderButton onClick={onTogglePanel} active={panelOpen}>
				&#x25E7; Context
			</HeaderButton>
		</div>
	);
}
