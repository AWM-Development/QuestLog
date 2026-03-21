import { type CSSProperties, useState } from "react";

interface ChatEmptyStateProps {
	onStarterClick: (prompt: string) => void;
}

const containerStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: "16px",
	flex: 1,
	textAlign: "center",
	padding: "40px 20px",
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
	gap: "8px",
	marginTop: "8px",
};

const starterStyle: CSSProperties = {
	padding: "8px 14px",
	borderRadius: "10px",
	border: "0.5px solid rgba(208,228,240,0.1)",
	background: "rgba(208,228,240,0.03)",
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
