import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../../../lib/trpc.js";
import type { DisplayMessage } from "../types.js";

interface UseChatReturn {
	messages: DisplayMessage[];
	sendMessage: (query: string) => Promise<void>;
	/** Aborts an in-flight stream (same as unmount). Wire to a Cancel control. */
	cancel: () => void;
	isLoading: boolean;
	isStreaming: boolean;
	streamingContent: string;
	error: { data?: { code?: string }; message?: string } | null;
	retry: () => void;
}

function jsonErrorMessage(body: unknown): string {
	if (!body || typeof body !== "object") return "Failed to get response";
	const o = body as Record<string, unknown>;
	const msg = o.message;
	const err = o.error;
	if (typeof msg === "string" && msg.length > 0) return msg;
	if (typeof err === "string" && err.length > 0) return err;
	return "Failed to get response";
}

function sseErrorCode(
	code: unknown,
): "TOO_MANY_REQUESTS" | "NOT_FOUND" | "INTERNAL_SERVER_ERROR" {
	if (code === 429) return "TOO_MANY_REQUESTS";
	if (code === 404) return "NOT_FOUND";
	return "INTERNAL_SERVER_ERROR";
}

/**
 * Core hook for sending chat messages and managing streaming state.
 *
 * Delivers assistant text via the SSE `/api/conversation/:id/stream` endpoint.
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
						message: jsonErrorMessage(errBody),
					};
				}

				const reader = response.body?.getReader();
				if (!reader) throw new Error("No response body");

				const decoder = new TextDecoder();
				let accumulated = "";
				let buffer = "";
				let currentEvent = "message";
				let currentDataLines: string[] = [];
				let hasDoneEvent = false;
				setIsStreaming(true);

				const flushEvent = () => {
					if (currentDataLines.length === 0) {
						currentEvent = "message";
						return;
					}

					const eventType = currentEvent;
					const rawData = currentDataLines.join("\n");
					currentEvent = "message";
					currentDataLines = [];

					let parsed: unknown;
					try {
						parsed = JSON.parse(rawData);
					} catch {
						return;
					}

					if (
						eventType === "delta" &&
						parsed &&
						typeof parsed === "object" &&
						"text" in parsed &&
						typeof parsed.text === "string"
					) {
						accumulated += parsed.text;
						setStreamingContent(accumulated);
						return;
					}

					if (
						eventType === "error" &&
						parsed &&
						typeof parsed === "object" &&
						"message" in parsed
					) {
						const code =
							"code" in parsed
								? sseErrorCode((parsed as { code?: unknown }).code)
								: "INTERNAL_SERVER_ERROR";
						const message =
							typeof parsed.message === "string"
								? parsed.message
								: "Failed to get response";
						throw {
							data: { code },
							message,
						};
					}

					if (eventType === "done") {
						hasDoneEvent = true;
					}
				};

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						if (line.startsWith("event: ")) {
							currentEvent = line.slice(7).trim() || "message";
							continue;
						}
						if (line.startsWith("data: ")) {
							currentDataLines.push(line.slice(6));
							continue;
						}
						if (line.trim() === "") {
							flushEvent();
						}
					}
				}
				flushEvent();

				if (!hasDoneEvent) {
					throw {
						data: { code: "INTERNAL_SERVER_ERROR" },
						message: "Stream ended before completion",
					};
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
					setOptimisticMessages([]);
					void utils.conversation.getMessages.invalidate({
						conversationId,
					});
					void utils.conversation.list.invalidate({ campaignId });
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

	const cancel = useCallback(() => {
		abortRef.current?.abort();
	}, []);

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
		cancel,
		isLoading,
		isStreaming,
		streamingContent,
		error,
		retry,
	};
}
