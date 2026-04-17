import { type CSSProperties, useEffect, useState } from "react";
import {
	chatMessageHeader,
	chatMessageLabel,
	chatStatusDot,
} from "../../../../components/styles.js";

interface ChatErrorMessageProps {
	error: { data?: { code?: string }; message?: string };
	onRetry: () => void;
}

const genericCardStyle: CSSProperties = {
	background: "var(--status-error-muted)",
	border: "1px solid var(--status-error)",
	borderRadius: "var(--r-lg)",
	padding: "var(--space-3) var(--space-5)",
	fontSize: "13px",
	lineHeight: 1.6,
	color: "var(--text-secondary)",
	maxWidth: "88%",
};

const rateLimitCardStyle: CSSProperties = {
	background: "var(--status-warning-muted)",
	border: "1px solid var(--status-warning)",
	borderRadius: "var(--r-lg)",
	padding: "var(--space-3) var(--space-5)",
	fontSize: "13px",
	lineHeight: 1.6,
	color: "var(--text-secondary)",
	maxWidth: "88%",
};

const retryButtonBase: CSSProperties = {
	marginTop: "10px",
	padding: "5px 12px",
	borderRadius: "var(--r-sm)",
	background: "transparent",
	fontSize: "12px",
	cursor: "pointer",
	fontFamily: "var(--font-body)",
	transition: "all 150ms ease",
};

export function ChatErrorMessage({ error, onRetry }: ChatErrorMessageProps) {
	const isRateLimit = error.data?.code === "TOO_MANY_REQUESTS";
	const [countdown, setCountdown] = useState(isRateLimit ? 10 : 0);

	useEffect(() => {
		if (!isRateLimit || countdown <= 0) return;
		const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
		return () => clearTimeout(timer);
	}, [isRateLimit, countdown]);

	if (isRateLimit) {
		return (
			<div style={{ animation: "msg-in 400ms ease-out" }}>
				<div style={chatMessageHeader}>
					<span
						style={{
							...chatStatusDot,
							background: "var(--status-warning)",
						}}
					/>
					<span style={chatMessageLabel}>QuestLog</span>
				</div>
				<div style={rateLimitCardStyle}>
					<div>The AI service is busy right now. Try again in a moment.</div>
					<button
						type="button"
						style={{
							...retryButtonBase,
							color: "var(--status-warning)",
							border: "0.5px solid var(--status-warning)",
						}}
						disabled={countdown > 0}
						onClick={onRetry}
					>
						{countdown > 0
							? `\u21BB Retry in ${countdown}s`
							: "\u21BB Try again"}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div style={{ animation: "msg-in 400ms ease-out" }}>
			<div style={chatMessageHeader}>
				<span
					style={{
						...chatStatusDot,
						background: "var(--status-error)",
					}}
				/>
				<span style={chatMessageLabel}>QuestLog</span>
			</div>
			<div style={genericCardStyle}>
				<div>
					Something went wrong generating a response. This might be a temporary
					issue with the AI service.
				</div>
				<button
					type="button"
					style={{
						...retryButtonBase,
						color: "var(--status-error)",
						border: "0.5px solid var(--status-error)",
					}}
					onClick={onRetry}
				>
					&#x21BB; Try again
				</button>
			</div>
		</div>
	);
}
