import type { CSSProperties, ReactNode } from "react";
import { chipBase, entityAvatarColors } from "./styles.js";

type ChipVariant = "entity" | "tag" | "badge" | "pill";
type EntityType = keyof typeof entityAvatarColors;

interface ChipProps {
	variant: ChipVariant;
	entityType?: EntityType;
	children: ReactNode;
	style?: CSSProperties;
}

const badgeStyle: CSSProperties = {
	...chipBase,
	backgroundColor: "var(--accent-muted)",
	color: "var(--accent)",
};

const pillStyle: CSSProperties = {
	...chipBase,
	borderRadius: "var(--r-pill)",
};

export function Chip({ variant, entityType, children, style }: ChipProps) {
	let computedStyle: CSSProperties;

	if (variant === "entity" && entityType) {
		computedStyle = {
			...chipBase,
			backgroundColor: entityAvatarColors[entityType].backgroundColor,
			color: entityAvatarColors[entityType].color,
		};
	} else if (variant === "badge") {
		computedStyle = badgeStyle;
	} else if (variant === "pill") {
		computedStyle = pillStyle;
	} else {
		computedStyle = chipBase;
	}

	return <span style={{ ...computedStyle, ...style }}>{children}</span>;
}
