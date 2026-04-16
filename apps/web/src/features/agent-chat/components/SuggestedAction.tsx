import { type CSSProperties, useState } from "react";
import { buttonAction } from "../../../components/styles.js";

interface SuggestedActionProps {
	label: string;
	onClick: (text: string) => void;
}

const actionStyle: CSSProperties = {
	...buttonAction,
	padding: "6px 12px",
	borderRadius: "var(--r-sm)",
	transition: "all 150ms ease",
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
