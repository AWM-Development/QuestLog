/** Source citation from the server's messages table */
export interface MessageSource {
	chunkId: string;
	sourceName: string;
	sourceId: string;
}

/** Message shape used across chat UI components */
export interface DisplayMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	sources?: MessageSource[] | null;
	isStreaming?: boolean;
	isOptimistic?: boolean;
}

/** Tag color mapping for consistent tag coloring */
export interface TagColor {
	bg: string;
	text: string;
}

export const TAG_COLORS: TagColor[] = [
	{ bg: "rgba(96,184,255,0.08)", text: "rgba(96,184,255,0.6)" },
	{ bg: "rgba(75,195,150,0.08)", text: "rgba(75,195,150,0.6)" },
	{ bg: "rgba(196,160,232,0.08)", text: "rgba(196,160,232,0.6)" },
	{ bg: "rgba(200,170,110,0.08)", text: "rgba(200,170,110,0.6)" },
	{ bg: "rgba(232,120,100,0.08)", text: "rgba(232,120,100,0.6)" },
];

export function getTagColor(tag: string): TagColor {
	let hash = 0;
	for (let i = 0; i < tag.length; i++) {
		hash = (hash << 5) - hash + tag.charCodeAt(i);
		hash = hash & hash;
	}
	const idx = Math.abs(hash) % TAG_COLORS.length;
	return TAG_COLORS[idx] as TagColor;
}
