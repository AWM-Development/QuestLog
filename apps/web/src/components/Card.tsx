import {
	type AnchorHTMLAttributes,
	type ButtonHTMLAttributes,
	type CSSProperties,
	type HTMLAttributes,
	type ReactNode,
	useState,
} from "react";
import { Link } from "react-router";
import { cardSurface } from "./styles.js";

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

	const hoverHandlers = hoverable
		? {
				onMouseEnter: () => setHovered(true),
				onMouseLeave: () => setHovered(false),
			}
		: {};

	if (as === "link" && href) {
		return (
			<Link
				to={href}
				style={computedStyle}
				{...hoverHandlers}
				{...(rest as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">)}
			>
				{children}
			</Link>
		);
	}

	if (as === "button") {
		return (
			<button
				type="button"
				style={computedStyle}
				{...hoverHandlers}
				{...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
			>
				{children}
			</button>
		);
	}

	return (
		<div
			style={computedStyle}
			{...hoverHandlers}
			{...(rest as HTMLAttributes<HTMLDivElement>)}
		>
			{children}
		</div>
	);
}
