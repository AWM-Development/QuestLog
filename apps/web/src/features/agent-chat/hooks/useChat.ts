import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import type { DisplayMessage } from "../types.js";

interface UseChatReturn {
	messages: DisplayMessage[];
	sendMessage: (query: string) => Promise<void>;
	isLoading: boolean;
	isStreaming: boolean;
	streamingContent: string;
	error: { data?: { code?: string }; message?: string } | null;
	retry: () => void;
}

/**
 * Core hook for sending chat messages and managing streaming state.
 *
 * Uses the SSE streaming endpoint for real-time token delivery,
 * with fallback to the tRPC mutation.
 */
export function useChat(
	campaignId: string,
	conversationId: string | undefined,
): UseChatReturn {
	const utils = trpc.useUtils();

	// Messages from server
	const messagesQuery = trpc.conversation.getMessages.useQuery(
		{ conversationId: conversationId ?? "" },
		{ enabled: !!conversationId },
	);

	// Local state for optimistic messages and streaming
	const [optimisticMessages, setOptimisticMessages] = useState<
		DisplayMessage[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const [streamingContent, setStreamingContent] = useState("");
	const [error, setError] = useState<UseChatReturn["error"]>(null);
	const lastQueryRef = useRef<string>("");
	const abortRef = useRef<AbortController | null>(null);

	const sendMessage = useCallback(
		async (query: string) => {
			if (!conversationId || !query.trim()) return;

			lastQueryRef.current = query;
			setError(null);
			setIsLoading(true);
			setIsStreaming(false);
			setStreamingContent("");

			// Optimistic user message
			const optimisticId = `opt-${Date.now()}`;
			const userMsg: DisplayMessage = {
				id: optimisticId,
				role: "user",
				content: query,
				isOptimistic: true,
			};
			setOptimisticMessages([userMsg]);

			try {
				// Use SSE streaming endpoint
				const apiUrl = import.meta.env.VITE_API_URL?.replace("/trpc", "") ?? "";
				const url = `${apiUrl}/api/conversation/${conversationId}/stream`;

				abortRef.current = new AbortController();

				const response = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ campaignId, query }),
					signal: abortRef.current.signal,
				});

				if (!response.ok) {
					const errBody = await response.json().catch(() => ({}));
					throw {
						data: {
							code:
								response.status === 429
									? "TOO_MANY_REQUESTS"
									: "INTERNAL_SERVER_ERROR",
						},
						message: errBody.message || "Failed to get response",
					};
				}

				const reader = response.body?.getReader();
				if (!reader) throw new Error("No response body");

				const decoder = new TextDecoder();
				let accumulated = "";
				let buffer = "";
				setIsStreaming(true);

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							const data = line.slice(6);
							try {
								const parsed = JSON.parse(data);
								if (parsed.text !== undefined) {
									accumulated += parsed.text;
									setStreamingContent(accumulated);
								}
								if (parsed.citations !== undefined) {
									// Stream complete — done event
									// Will refetch messages
								}
								if (parsed.error !== undefined) {
									throw {
										data: { code: parsed.code },
										message: parsed.message,
									};
								}
							} catch (e) {
								if (e && typeof e === "object" && "data" in e) {
									throw e;
								}
							}
						}
					}
				}

				// Stream complete — refetch messages from server
				setOptimisticMessages([]);
				setStreamingContent("");
				setIsStreaming(false);
				await utils.conversation.getMessages.invalidate({
					conversationId,
				});
				// Also refresh conversation list to update timestamps
				utils.conversation.list.invalidate({ campaignId });
			} catch (err) {
				setIsStreaming(false);
				setStreamingContent("");
				if (err instanceof DOMException && err.name === "AbortError") {
					return;
				}
				setError(err as { data?: { code?: string }; message?: string });
			} finally {
				setIsLoading(false);
				abortRef.current = null;
			}
		},
		[conversationId, campaignId, utils],
	);

	const retry = useCallback(() => {
		if (lastQueryRef.current) {
			sendMessage(lastQueryRef.current);
		}
	}, [sendMessage]);

	// Merge server messages with optimistic/streaming messages
	const serverMessages: DisplayMessage[] = (messagesQuery.data ?? []).map(
		(m) => ({
			id: m.id,
			role: m.role,
			content: m.content,
			sources: m.sources,
		}),
	);

	// Abort in-progress stream on unmount
	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	const allMessages = [...serverMessages, ...optimisticMessages];

	// Add streaming message if actively streaming
	if (isStreaming && streamingContent) {
		allMessages.push({
			id: "streaming",
			role: "assistant",
			content: streamingContent,
			isStreaming: true,
		});
	}

	return {
		messages: allMessages,
		sendMessage,
		isLoading,
		isStreaming,
		streamingContent,
		error,
		retry,
	};
}
