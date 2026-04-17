import type { CSSProperties, ReactNode } from "react";
import { Button } from "../Button.js";
import { inlineAlertError, inlineAlertWarning } from "../styles.js";

type AlertVariant = "error" | "warning";
type AlertLayout = "centered" | "inline";

interface AlertProps {
	variant?: AlertVariant;
	layout?: AlertLayout;
	title?: string;
	onRetry?: () => void;
	role?: "alert" | "status";
	children: ReactNode;
	style?: CSSProperties;
}

const variantColor: Record<AlertVariant, string> = {
	error: "var(--status-error)",
	warning: "var(--status-warning)",
};

const inlineBase: Record<AlertVariant, CSSProperties> = {
	error: inlineAlertError,
	warning: inlineAlertWarning,
};

export function Alert({
	variant = "error",
	layout = "centered",
	title,
	onRetry,
	role,
	children,
	style,
}: AlertProps) {
	const resolvedRole = role ?? (variant === "error" ? "alert" : "status");

	const containerStyle: CSSProperties =
		layout === "centered"
			? {
					backgroundColor: "var(--bg-elevated)",
					borderRadius: "var(--r-md)",
					padding: "var(--space-8)",
					textAlign: "center",
					color: variantColor[variant],
					...style,
				}
			: {
					...inlineBase[variant],
					color: variantColor[variant],
					...style,
				};

	return (
		<div role={resolvedRole} style={containerStyle}>
			{title && (
				<p style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>
					{title}
				</p>
			)}
			<div
				style={{
					fontSize: "0.875rem",
					color: layout === "centered" ? "var(--text-muted)" : undefined,
					marginBottom: onRetry ? "var(--space-6)" : undefined,
				}}
			>
				{children}
			</div>
			{onRetry && (
				<Button variant="accent" onClick={onRetry}>
					Retry
				</Button>
			)}
		</div>
	);
}
