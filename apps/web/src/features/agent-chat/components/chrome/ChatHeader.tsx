import { type CSSProperties, useEffect, useState } from "react";
import { IconButton } from "../../../../components/IconButton.js";
import { Chip } from "../../../../components/primitives/Chip.js";
import { chatHeaderBar } from "../../styles.js";
import { ConversationTags } from "./ConversationTags.js";

interface ChatHeaderProps {
	campaignName?: string;
	conversationTitle: string | null;
	conversationTags: string[];
	allTags: string[];
	drawerOpen: boolean;
	contextPanelActive: boolean;
	notesPanelActive: boolean;
	onToggleDrawer: () => void;
	onOpenNotes: () => void;
	onToggleContextPanel: () => void;
	onEditTitle: (title: string) => void;
	onUpdateTags: (tags: string[]) => void;
}

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
	ariaLabel,
}: {
	children: React.ReactNode;
	onClick?: () => void;
	active?: boolean;
	ariaLabel?: string;
}) {
	const [hovered, setHovered] = useState(false);
	return (
		<button
			type="button"
			aria-label={ariaLabel}
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
	contextPanelActive,
	notesPanelActive,
	onToggleDrawer,
	onOpenNotes,
	onToggleContextPanel,
	onEditTitle,
	onUpdateTags,
}: ChatHeaderProps) {
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleValue, setTitleValue] = useState(conversationTitle ?? "");

	useEffect(() => {
		if (!editingTitle) {
			setTitleValue(conversationTitle ?? "");
		}
	}, [conversationTitle, editingTitle]);

	const handleTitleSave = () => {
		const trimmed = titleValue.trim();
		if (trimmed && trimmed !== conversationTitle) {
			onEditTitle(trimmed);
		}
		setEditingTitle(false);
	};

	return (
		<div style={chatHeaderBar}>
			<IconButton
				label={drawerOpen ? "Close drawer" : "Open drawer"}
				size={28}
				onClick={onToggleDrawer}
				style={{ flexShrink: 0 }}
			>
				&#x2630;
			</IconButton>

			{campaignName && (
				<Chip
					variant="badge"
					style={{
						borderRadius: "var(--r-pill)",
						padding: "2px 10px",
						border: "0.5px solid var(--ent-npc-border)",
						fontWeight: 500,
						flexShrink: 0,
					}}
				>
					{campaignName}
				</Chip>
			)}

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
					aria-label="Edit conversation title"
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
						borderRadius: "var(--r-sm)",
						border: "0.5px solid var(--border)",
						background: "var(--bg-surface)",
					}}
				>
					&#x2318;K
				</kbd>
			</span>

			<HeaderButton
				onClick={onOpenNotes}
				active={notesPanelActive}
				ariaLabel="Open session notes"
			>
				&#x1F4DD; Notes
			</HeaderButton>

			<HeaderButton
				onClick={onToggleContextPanel}
				active={contextPanelActive}
				ariaLabel="Toggle context panel"
			>
				&#x25E7; Context
			</HeaderButton>
		</div>
	);
}
