import type { CSSProperties, ReactNode } from "react";
import { Button } from "./Button.js";

interface AlertProps {
	title?: string;
	onRetry?: () => void;
	children: ReactNode;
	style?: CSSProperties;
}

export function Alert({ title, onRetry, children, style }: AlertProps) {
	return (
		<div
			role="alert"
			style={{
				backgroundColor: "var(--bg-elevated)",
				borderRadius: "var(--r-md)",
				padding: "var(--space-8)",
				textAlign: "center",
				color: "var(--status-error)",
				...style,
			}}
		>
			{title && (
				<p style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>
					{title}
				</p>
			)}
			<p
				style={{
					fontSize: "0.875rem",
					color: "var(--text-muted)",
					marginBottom: onRetry ? "var(--space-6)" : undefined,
				}}
			>
				{children}
			</p>
			{onRetry && (
				<Button variant="accent" onClick={onRetry}>
					Retry
				</Button>
			)}
		</div>
	);
}
