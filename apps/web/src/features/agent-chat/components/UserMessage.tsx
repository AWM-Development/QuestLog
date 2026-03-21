import type { CSSProperties } from "react";

const userMessageStyle: CSSProperties = {
	maxWidth: "60%",
	marginLeft: "auto",
	background: "var(--bg-elevated)",
	border: "1px solid var(--border)",
	borderRadius: "14px 14px 4px 14px",
	padding: "12px 16px",
	fontSize: "14px",
	color: "var(--text-primary)",
	lineHeight: 1.5,
	whiteSpace: "pre-wrap",
	animation: "msg-in 200ms ease",
};

interface UserMessageProps {
	content: string;
}

export function UserMessage({ content }: UserMessageProps) {
	return <div style={userMessageStyle}>{content}</div>;
}
