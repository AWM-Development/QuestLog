import {
	type AnchorHTMLAttributes,
	type ButtonHTMLAttributes,
	type CSSProperties,
	type HTMLAttributes,
	type ReactNode,
	useState,
} from "react";
import { Link } from "react-router";
import { cardSurface } from "../styles.js";

type CardAs = "div" | "button" | "link";

interface CardBaseProps {
	as?: CardAs;
	hoverable?: boolean;
	href?: string;
	children: ReactNode;
	style?: CSSProperties;
}

type CardDivProps = CardBaseProps &
	HTMLAttributes<HTMLDivElement> & { as?: "div" };
type CardButtonProps = CardBaseProps &
	ButtonHTMLAttributes<HTMLButtonElement> & { as: "button" };
type CardLinkProps = CardBaseProps &
	Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
		as: "link";
		href: string;
	};

type CardProps = CardDivProps | CardButtonProps | CardLinkProps;

export function Card({
	as = "div",
	hoverable = false,
	href,
	children,
	style,
	...rest
}: CardProps) {
	const [hovered, setHovered] = useState(false);

	const computedStyle: CSSProperties = {
		...cardSurface,
		...(hoverable && hovered
			? {
					backgroundColor: "var(--bg-focal)",
					borderColor: "var(--border)",
				}
			: {}),
		...style,
	};

	if (as === "link" && href) {
		const { onMouseEnter, onMouseLeave, ...linkRest } = rest as Omit<
			AnchorHTMLAttributes<HTMLAnchorElement>,
			"href"
		>;

		return (
			<Link
				to={href}
				style={computedStyle}
				onMouseEnter={(e) => {
					if (hoverable) setHovered(true);
					onMouseEnter?.(e);
				}}
				onMouseLeave={(e) => {
					if (hoverable) setHovered(false);
					onMouseLeave?.(e);
				}}
				{...linkRest}
			>
				{children}
			</Link>
		);
	}

	if (as === "button") {
		const { onMouseEnter, onMouseLeave, ...buttonRest } =
			rest as ButtonHTMLAttributes<HTMLButtonElement>;

		return (
			<button
				type="button"
				style={computedStyle}
				onMouseEnter={(e) => {
					if (hoverable) setHovered(true);
					onMouseEnter?.(e);
				}}
				onMouseLeave={(e) => {
					if (hoverable) setHovered(false);
					onMouseLeave?.(e);
				}}
				{...buttonRest}
			>
				{children}
			</button>
		);
	}

	const { onMouseEnter, onMouseLeave, ...divRest } =
		rest as HTMLAttributes<HTMLDivElement>;

	return (
		<div
			style={computedStyle}
			onMouseEnter={(e) => {
				if (hoverable) setHovered(true);
				onMouseEnter?.(e);
			}}
			onMouseLeave={(e) => {
				if (hoverable) setHovered(false);
				onMouseLeave?.(e);
			}}
			{...divRest}
		>
			{children}
		</div>
	);
}
