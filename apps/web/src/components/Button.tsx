import { type ButtonHTMLAttributes, type CSSProperties, useState } from "react";
import {
	buttonAccent,
	buttonAction,
	buttonGhost,
	buttonSecondary,
	buttonSmallAccent,
	buttonSmallSecondary,
} from "./styles.js";

type ButtonVariant = "accent" | "secondary" | "ghost" | "action";
type ButtonSize = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
}

const baseByVariant: Record<ButtonVariant, CSSProperties> = {
	accent: buttonAccent,
	secondary: buttonSecondary,
	ghost: buttonGhost,
	action: buttonAction,
};

const smallByVariant: Partial<Record<ButtonVariant, CSSProperties>> = {
	accent: buttonSmallAccent,
	secondary: buttonSmallSecondary,
};

const hoverByVariant: Record<ButtonVariant, CSSProperties> = {
	accent: { backgroundColor: "var(--accent-hover)" },
	secondary: {
		borderColor: "var(--border-hover)",
		color: "var(--text-secondary)",
	},
	ghost: { color: "var(--text-secondary)" },
	action: {
		color: "var(--accent)",
		borderColor: "var(--ent-npc-border)",
		backgroundColor: "var(--accent-muted)",
	},
};

export function Button({
	variant,
	size = "md",
	loading = false,
	disabled,
	type = "button",
	children,
	style,
	onMouseEnter,
	onMouseLeave,
	...rest
}: ButtonProps) {
	const [hovered, setHovered] = useState(false);
	const isDisabled = disabled || loading;

	const base =
		size === "sm" && smallByVariant[variant]
			? smallByVariant[variant]
			: baseByVariant[variant];

	const computedStyle: CSSProperties = {
		...base,
		...(isDisabled
			? {
					opacity: loading ? 0.6 : 0.4,
					cursor: "not-allowed",
				}
			: hovered
				? hoverByVariant[variant]
				: {}),
		...style,
	};

	return (
		<button
			type={type}
			disabled={isDisabled}
			style={computedStyle}
			onMouseEnter={(e) => {
				setHovered(true);
				onMouseEnter?.(e);
			}}
			onMouseLeave={(e) => {
				setHovered(false);
				onMouseLeave?.(e);
			}}
			{...rest}
		>
			{children}
		</button>
	);
}
