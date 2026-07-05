import type { CSSProperties } from "react";

const userMessageStyle: CSSProperties = {
	maxWidth: "60%",
	marginLeft: "auto",
	background: "var(--bg-elevated)",
	border: "1px solid var(--border)",
	borderRadius: "var(--r-xl) var(--r-xl) var(--r-sm) var(--r-xl)",
	padding: "var(--space-3) var(--space-4)",
	fontSize: "14px",
	color: "var(--text-primary)",
	lineHeight: 1.5,
	whiteSpace: "pre-wrap",
	animation: "msg-in 400ms ease-out",
};

interface UserMessageProps {
	content: string;
}

export function UserMessage({ content }: UserMessageProps) {
	return <div style={userMessageStyle}>{content}</div>;
}
