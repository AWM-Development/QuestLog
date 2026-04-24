import { type CSSProperties, useState } from "react";
import { Chip } from "../../../../components/buttons/Chip.js";
import { IconButton } from "../../../../components/buttons/IconButton.js";
import { getTagColor } from "../../types.js";

interface ConversationListItemProps {
	conversation: {
		id: string;
		title: string | null;
		tags: string[];
		status: string;
		updatedAt: Date;
	};
	isActive: boolean;
	onSelect: (id: string) => void;
	onArchive: (id: string) => void;
	onEditTitle: (id: string, title: string) => void;
}

const itemStyle: CSSProperties = {
	padding: "var(--space-2) var(--space-3)",
	borderRadius: "var(--r-sm)",
	cursor: "pointer",
	transition: "all 150ms ease",
	position: "relative",
};

const activeStyle: CSSProperties = {
	background: "var(--state-active-soft)",
	borderWidth: "0.5px",
	borderStyle: "solid",
	borderColor: "var(--state-active-border)",
};

const hoverStyle: CSSProperties = {
	background: "var(--state-hover-soft)",
};

const titleStyle: CSSProperties = {
	fontSize: "12px",
	fontWeight: 500,
	color: "var(--text-primary)",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	margin: 0,
};

const timestampStyle: CSSProperties = {
	fontSize: "10px",
	color: "var(--text-dim)",
	marginTop: "var(--space-1)",
};

const tagsRowStyle: CSSProperties = {
	display: "flex",
	gap: "var(--space-1)",
	marginTop: "var(--space-1)",
	flexWrap: "wrap",
};

const actionsStyle: CSSProperties = {
	position: "absolute",
	right: "var(--space-2)",
	top: "50%",
	transform: "translateY(-50%)",
	display: "flex",
	gap: "var(--space-1)",
};

const rowButtonStyle: CSSProperties = {
	display: "block",
	width: "100%",
	textAlign: "left",
	background: "none",
	border: "none",
	padding: 0,
	fontFamily: "var(--font-body)",
	color: "inherit",
	cursor: "pointer",
};

function formatTimestamp(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin} min ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
	if (diffHr < 48) return "Yesterday";
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConversationListItem({
	conversation,
	isActive,
	onSelect,
	onArchive,
	onEditTitle,
}: ConversationListItemProps) {
	const [hovered, setHovered] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editValue, setEditValue] = useState(conversation.title ?? "");

	const handleTitleSave = () => {
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== conversation.title) {
			onEditTitle(conversation.id, trimmed);
		}
		setEditing(false);
	};

	return (
		<div
			style={{
				...itemStyle,
				...(isActive ? activeStyle : {}),
				...(!isActive && hovered ? hoverStyle : {}),
			}}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{editing ? (
				<input
					type="text"
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onBlur={handleTitleSave}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleTitleSave();
						if (e.key === "Escape") setEditing(false);
						e.stopPropagation();
					}}
					onClick={(e) => e.stopPropagation()}
					// biome-ignore lint/a11y/noAutofocus: inline edit should auto-focus
					autoFocus
					style={{
						...titleStyle,
						background: "var(--bg-elevated)",
						border: "1px solid var(--border-hover)",
						borderRadius: "var(--r-sm)",
						padding: "var(--space-0-5) var(--space-1-5)",
						outline: "none",
						width: "100%",
					}}
				/>
			) : (
				<button
					type="button"
					style={rowButtonStyle}
					onClick={() => onSelect(conversation.id)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							onSelect(conversation.id);
						}
					}}
					aria-label={conversation.title ?? "Untitled conversation"}
				>
					<p style={titleStyle}>
						{conversation.title || (
							<span
								style={{
									fontStyle: "italic",
									color: "var(--text-muted)",
								}}
							>
								Untitled conversation
							</span>
						)}
					</p>

					<div style={timestampStyle}>
						{formatTimestamp(new Date(conversation.updatedAt))}
					</div>

					{conversation.tags.length > 0 && (
						<div style={tagsRowStyle}>
							{conversation.tags.map((tag) => {
								const color = getTagColor(tag);
								return (
									<Chip
										key={tag}
										variant="tag"
										style={{
											fontSize: "9px",
											padding: "var(--space-1) var(--space-2)",
											backgroundColor: color.bg,
											color: color.text,
										}}
									>
										{tag}
									</Chip>
								);
							})}
						</div>
					)}
				</button>
			)}

			{hovered && !editing && (
				<div style={actionsStyle}>
					<IconButton
						label="Edit title"
						size={24}
						title="Edit title"
						onClick={(e) => {
							e.stopPropagation();
							setEditValue(conversation.title ?? "");
							setEditing(true);
						}}
					>
						&#x270F;&#xFE0F;
					</IconButton>
					<IconButton
						label="Archive conversation"
						size={24}
						title="Archive"
						style={{ color: "var(--status-error)", opacity: 0.5 }}
						onClick={(e) => {
							e.stopPropagation();
							onArchive(conversation.id);
						}}
					>
						&#x1F5D1;&#xFE0F;
					</IconButton>
				</div>
			)}
		</div>
	);
}
