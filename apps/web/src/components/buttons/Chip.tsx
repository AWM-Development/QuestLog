import type {
	ButtonHTMLAttributes,
	CSSProperties,
	HTMLAttributes,
	ReactNode,
} from "react";
import {
	chipBase,
	entityAvatarColors,
	sourceChipBase,
	sourceChipColors,
} from "../styles.js";

type ChipVariant = "entity" | "tag" | "badge" | "pill" | "source";
type EntityType = keyof typeof entityAvatarColors;
type SourceType = keyof typeof sourceChipColors;
type ChipAs = "span" | "button";

interface ChipBaseProps {
	variant: ChipVariant;
	entityType?: EntityType;
	sourceType?: SourceType;
	as?: ChipAs;
	children: ReactNode;
	style?: CSSProperties;
}

type ChipSpanProps = ChipBaseProps &
	HTMLAttributes<HTMLSpanElement> & { as?: "span" };
type ChipButtonProps = ChipBaseProps &
	ButtonHTMLAttributes<HTMLButtonElement> & { as: "button" };
type ChipProps = ChipSpanProps | ChipButtonProps;

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
	sourceType = "entity",
	as = "span",
	children,
	style,
	...rest
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
	} else if (variant === "source") {
		computedStyle = {
			...sourceChipBase,
			...sourceChipColors[sourceType],
		};
	} else if (variant === "pill") {
		computedStyle = pillStyle;
	} else {
		computedStyle = chipBase;
	}

	if (as === "button") {
		return (
			<button
				type="button"
				style={{ ...computedStyle, ...style }}
				{...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
			>
				{children}
			</button>
		);
	}

	return (
		<span
			style={{ ...computedStyle, ...style }}
			{...(rest as HTMLAttributes<HTMLSpanElement>)}
		>
			{children}
		</span>
	);
}
