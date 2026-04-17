import type { CSSProperties, ReactNode } from "react";
import {
	chipBase,
	entityAvatarColors,
	sourceChipBase,
	sourceChipColors,
} from "./styles.js";

type ChipVariant = "entity" | "tag" | "badge" | "pill" | "source";
type EntityType = keyof typeof entityAvatarColors;
type SourceType = keyof typeof sourceChipColors;

interface ChipProps {
	variant: ChipVariant;
	entityType?: EntityType;
	sourceType?: SourceType;
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

export function Chip({
	variant,
	entityType,
	sourceType,
	children,
	style,
}: ChipProps) {
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
	} else if (variant === "source" && sourceType) {
		computedStyle = { ...sourceChipBase, ...sourceChipColors[sourceType] };
	} else {
		computedStyle = chipBase;
	}

	return <span style={{ ...computedStyle, ...style }}>{children}</span>;
}
