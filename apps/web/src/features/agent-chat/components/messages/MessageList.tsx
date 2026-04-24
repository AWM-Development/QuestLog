import type { CSSProperties } from "react";
import { useAutoScroll } from "../../hooks/useAutoScroll.js";
import type { DisplayMessage } from "../../types.js";
import { AgentMessage } from "./AgentMessage.js";
import { ChatEmptyState } from "./ChatEmptyState.js";
import { ChatErrorMessage } from "./ChatErrorMessage.js";
import { UserMessage } from "./UserMessage.js";

interface MessageListProps {
	messages: DisplayMessage[];
	isLoading: boolean;
	error: { data?: { code?: string }; message?: string } | null;
	onRetry: () => void;
	onStarterClick: (prompt: string) => void;
	hasConversation: boolean;
}

const messageListStyle: CSSProperties = {
	flex: 1,
	overflowY: "auto",
	padding: "var(--space-6) var(--space-5)",
	display: "flex",
	flexDirection: "column",
	gap: "var(--space-6)",
};

const skeletonContainerStyle: CSSProperties = {
	flex: 1,
	display: "flex",
	flexDirection: "column",
	gap: "var(--space-6)",
	padding: "var(--space-6) var(--space-5)",
};

const skeletonHeaderStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "var(--space-1-5)",
	marginBottom: "var(--space-2)",
};

const skeletonBarStyle = (width: string): CSSProperties => ({
	height: "12px",
	borderRadius: "var(--r-sm)",
	background: "var(--bg-elevated)",
	width,
	animation: "pulse 1s ease-in-out infinite",
});

function LoadingSkeleton() {
	return (
		<div style={skeletonContainerStyle}>
			<div>
				<div style={skeletonHeaderStyle}>
					<span
						style={{
							width: 6,
							height: 6,
							borderRadius: "50%",
							background: "var(--bg-elevated)",
						}}
					/>
					<span
						style={{
							fontSize: "11px",
							color: "var(--text-dim)",
						}}
					>
						Loading messages...
					</span>
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "var(--space-2-5)",
					}}
				>
					<div style={skeletonBarStyle("85%")} />
					<div style={skeletonBarStyle("72%")} />
					<div style={skeletonBarStyle("60%")} />
				</div>
			</div>
		</div>
	);
}

export function MessageList({
	messages,
	isLoading,
	error,
	onRetry,
	onStarterClick,
	hasConversation,
}: MessageListProps) {
	const { containerRef } = useAutoScroll(messages.length);

	if (isLoading && messages.length === 0) {
		return <LoadingSkeleton />;
	}

	if (!hasConversation || messages.length === 0) {
		return <ChatEmptyState onStarterClick={onStarterClick} />;
	}

	return (
		<div
			ref={containerRef}
			style={messageListStyle}
			role="log"
			aria-live="polite"
		>
			{messages.map((msg) =>
				msg.role === "user" ? (
					<UserMessage key={msg.id} content={msg.content} />
				) : (
					<AgentMessage
						key={msg.id}
						content={msg.content}
						sources={msg.sources ?? undefined}
						isStreaming={msg.isStreaming}
					/>
				),
			)}
			{error && <ChatErrorMessage error={error} onRetry={onRetry} />}
		</div>
	);
}
