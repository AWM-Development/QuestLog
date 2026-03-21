import type { CSSProperties, ReactNode } from "react";
import {
	chatMessageHeader,
	chatMessageLabel,
	chatStatusDot,
} from "../../../components/styles.js";
import type { MessageSource } from "../types.js";
import { SourceChip } from "./SourceChip.js";
import { StreamingCursor } from "./StreamingCursor.js";

interface AgentMessageProps {
	content: string;
	sources?: MessageSource[];
	isStreaming?: boolean;
}

const agentMessageStyle: CSSProperties = {
	maxWidth: "88%",
	fontSize: "14px",
	color: "var(--text-secondary)",
	lineHeight: 1.75,
	animation: "msg-in 400ms ease-out",
};

const sourcesRowStyle: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: "6px",
	marginTop: "12px",
};

/** Render agent text with basic markdown: **bold** → <strong> */
function renderContent(text: string) {
	const segments: ReactNode[] = [];
	const boldRegex = /\*\*[^*]+\*\*/g;
	let lastIndex = 0;

	for (const match of text.matchAll(boldRegex)) {
		const full = match[0];
		const start = match.index ?? 0;

		if (start > lastIndex) {
			segments.push(text.slice(lastIndex, start));
		}

		segments.push(
			<strong
				key={`${start}-${full}`}
				style={{ color: "var(--text-primary)", fontWeight: 500 }}
			>
				{full.slice(2, -2)}
			</strong>,
		);

		lastIndex = start + full.length;
	}

	if (lastIndex < text.length) {
		segments.push(text.slice(lastIndex));
	}

	return segments;
}

export function AgentMessage({
	content,
	sources,
	isStreaming,
}: AgentMessageProps) {
	return (
		<div style={agentMessageStyle}>
			<div style={chatMessageHeader}>
				<span
					style={{
						...chatStatusDot,
						background: "var(--status-success)",
					}}
				/>
				<span style={chatMessageLabel}>QuestLog</span>
			</div>

			<div style={{ whiteSpace: "pre-wrap" }}>
				{renderContent(content)}
				{isStreaming && <StreamingCursor />}
			</div>

			{sources && sources.length > 0 && (
				<div style={sourcesRowStyle}>
					{sources.map((source) => (
						<SourceChip key={source.chunkId} source={source} />
					))}
				</div>
			)}

			{/* SuggestedActions will plug in here when the backend supports them */}
		</div>
	);
}
