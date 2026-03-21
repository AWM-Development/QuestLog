import type { CSSProperties } from "react";
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
	animation: "msg-in 200ms ease",
};

const agentHeaderStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "6px",
	marginBottom: "8px",
};

const statusDotStyle: CSSProperties = {
	width: 6,
	height: 6,
	borderRadius: "50%",
	background: "var(--status-success)",
	flexShrink: 0,
};

const agentLabelStyle: CSSProperties = {
	fontSize: "11px",
	fontWeight: 500,
	color: "var(--text-muted)",
};

const sourcesRowStyle: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: "6px",
	marginTop: "12px",
};

/** Render agent text with basic markdown: **bold** → <strong> */
function renderContent(text: string) {
	const parts = text.split(/(\*\*[^*]+\*\*)/g);
	return parts.map((part, i) => {
		if (part.startsWith("**") && part.endsWith("**")) {
			return (
				<strong
					key={i}
					style={{ color: "var(--text-primary)", fontWeight: 500 }}
				>
					{part.slice(2, -2)}
				</strong>
			);
		}
		return part;
	});
}

export function AgentMessage({
	content,
	sources,
	isStreaming,
}: AgentMessageProps) {
	return (
		<div style={agentMessageStyle}>
			<div style={agentHeaderStyle}>
				<span style={statusDotStyle} />
				<span style={agentLabelStyle}>QuestLog</span>
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
