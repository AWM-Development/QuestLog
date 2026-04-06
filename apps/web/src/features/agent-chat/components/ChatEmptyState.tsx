import { type CSSProperties, useState } from "react";

interface ChatEmptyStateProps {
	onStarterClick: (prompt: string) => void;
}

const containerStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: "var(--space-4)",
	flex: 1,
	minHeight: 0,
	textAlign: "center",
	padding: "var(--space-8) var(--space-5)",
	overflow: "auto",
};

const mascotStyle: CSSProperties = {
	fontSize: "40px",
	opacity: 0.3,
};

const headingStyle: CSSProperties = {
	fontFamily: "var(--font-display)",
	fontSize: "20px",
	fontWeight: 600,
	color: "var(--text-secondary)",
	margin: 0,
};

const subtextStyle: CSSProperties = {
	fontSize: "13px",
	color: "var(--text-dim)",
	maxWidth: "380px",
	lineHeight: 1.6,
	margin: 0,
};

const promptsRowStyle: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	justifyContent: "center",
	gap: "var(--space-2)",
	marginTop: "var(--space-2)",
};

const starterStyle: CSSProperties = {
	padding: "var(--space-2) var(--space-3)",
	borderRadius: "var(--r-md)",
	border: "0.5px solid var(--border)",
	background: "var(--state-hover-soft)",
	fontSize: "12px",
	color: "var(--text-muted)",
	cursor: "pointer",
	transition: "all 150ms ease",
	fontFamily: "var(--font-body)",
};

const starterHoverStyle: CSSProperties = {
	borderColor: "var(--border-hover)",
	color: "var(--text-secondary)",
};

const STARTER_PROMPTS = [
	"Prep next session",
	"Recap last session",
	"Generate NPC dialogue",
	"What loose threads exist?",
];

function StarterButton({
	label,
	onClick,
}: { label: string; onClick: (t: string) => void }) {
	const [hovered, setHovered] = useState(false);
	return (
		<button
			type="button"
			style={{ ...starterStyle, ...(hovered ? starterHoverStyle : {}) }}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onClick={() => onClick(label)}
		>
			{label}
		</button>
	);
}

export function ChatEmptyState({ onStarterClick }: ChatEmptyStateProps) {
	return (
		<div style={containerStyle}>
			<div style={mascotStyle} aria-hidden="true">
				&#x1F409;
			</div>
			<h2 style={headingStyle}>What would you like to explore?</h2>
			<p style={subtextStyle}>
				Ask about your campaign lore, generate NPC dialogue, plan encounters, or
				explore storylines.
			</p>
			<div style={promptsRowStyle}>
				{STARTER_PROMPTS.map((prompt) => (
					<StarterButton key={prompt} label={prompt} onClick={onStarterClick} />
				))}
			</div>
		</div>
	);
}
