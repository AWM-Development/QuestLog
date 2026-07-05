import type { CSSProperties } from "react";

interface SessionEmptyStateProps {
	onDismiss: () => void;
	onPasteFromClipboard?: () => void;
	onPullRecap?: () => void;
}

const cardStyle: CSSProperties = {
	backgroundColor: "var(--bg-surface)",
	border: "1px solid var(--border-subtle)",
	borderRadius: "12px",
	padding: "20px",
	marginTop: "var(--space-5)",
};

const headerRowStyle: CSSProperties = {
	display: "flex",
	alignItems: "flex-start",
	gap: "var(--space-3)",
	marginBottom: "var(--space-4)",
};

const mascotTileStyle: CSSProperties = {
	width: 44,
	height: 44,
	borderRadius: "var(--r-md)",
	backgroundColor: "var(--bg-elevated)",
	flexShrink: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: "1.25rem",
};

const headlineStyle: CSSProperties = {
	fontSize: "0.875rem",
	fontWeight: 600,
	color: "var(--text-primary)",
	marginBottom: "var(--space-1)",
};

const supportStyle: CSSProperties = {
	fontSize: "0.75rem",
	color: "var(--text-secondary)",
	lineHeight: 1.5,
};

const gridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "1fr 1fr",
	gap: "8px",
};

const actionBtnStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	gap: "var(--space-0-5)",
	padding: "var(--space-2-5) var(--space-3)",
	borderRadius: "var(--r-md)",
	border: "0.5px solid var(--border)",
	backgroundColor: "var(--bg-elevated)",
	cursor: "pointer",
	textAlign: "left",
	transition: "all 0.15s",
};

const actionBtnDisabledStyle: CSSProperties = {
	...actionBtnStyle,
	cursor: "not-allowed",
	opacity: 0.45,
};

const actionLabelStyle: CSSProperties = {
	fontSize: "0.75rem",
	fontWeight: 500,
	color: "var(--text-primary)",
};

const actionHintStyle: CSSProperties = {
	fontSize: "0.625rem",
	color: "var(--text-muted)",
};

export function SessionEmptyState({
	onDismiss,
	onPasteFromClipboard,
	onPullRecap,
}: SessionEmptyStateProps) {
	return (
		<div data-testid="session-empty-state" style={cardStyle}>
			<div style={headerRowStyle}>
				<div data-testid="mascot-tile" style={mascotTileStyle}>
					⬡
				</div>
				<div>
					<p style={headlineStyle}>How would you like to start?</p>
					<p style={supportStyle}>
						Pick a starting point — or just begin writing and QuestLog will
						surface entities as you go.
					</p>
				</div>
			</div>
			<div style={gridStyle}>
				<button
					type="button"
					aria-label="Pull recap from prior session"
					style={onPullRecap ? actionBtnStyle : actionBtnDisabledStyle}
					disabled={!onPullRecap}
					onClick={onPullRecap}
				>
					<span style={actionLabelStyle}>Pull recap</span>
					<span style={actionHintStyle}>From prior session summary</span>
				</button>
				<button
					type="button"
					aria-label="Start from prep brief (Coming in M5)"
					style={actionBtnDisabledStyle}
					disabled
					title="Coming in M5"
				>
					<span style={actionLabelStyle}>Prep brief</span>
					<span style={actionHintStyle}>Coming in M5</span>
				</button>
				<button
					type="button"
					aria-label="Paste from clipboard"
					style={actionBtnStyle}
					onClick={() => onPasteFromClipboard?.()}
				>
					<span style={actionLabelStyle}>Paste from clipboard</span>
					<span style={actionHintStyle}>Import your existing notes</span>
				</button>
				<button
					type="button"
					aria-label="Begin blank"
					style={actionBtnStyle}
					onClick={onDismiss}
				>
					<span style={actionLabelStyle}>Begin blank</span>
					<span style={actionHintStyle}>Start with an empty page</span>
				</button>
			</div>
		</div>
	);
}
