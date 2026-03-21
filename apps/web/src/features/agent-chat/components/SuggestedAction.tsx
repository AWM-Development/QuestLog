import { type CSSProperties, useState } from "react";

interface SuggestedActionProps {
	label: string;
	onClick: (text: string) => void;
}

const actionStyle: CSSProperties = {
	padding: "6px 12px",
	borderRadius: "6px",
	border: "0.5px solid var(--border)",
	background: "rgba(14,24,32,0.6)",
	fontSize: "12px",
	color: "var(--text-secondary)",
	cursor: "pointer",
	transition: "all 150ms ease",
	fontFamily: "var(--font-body)",
};

const actionHoverStyle: CSSProperties = {
	color: "var(--accent)",
	borderColor: "var(--ent-npc-border)",
	background: "var(--accent-muted)",
	transform: "translateY(-1px)",
};

export function SuggestedAction({ label, onClick }: SuggestedActionProps) {
	const [hovered, setHovered] = useState(false);

	return (
		<button
			type="button"
			style={{ ...actionStyle, ...(hovered ? actionHoverStyle : {}) }}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onClick={() => onClick(label)}
		>
			{label}
		</button>
	);
}
