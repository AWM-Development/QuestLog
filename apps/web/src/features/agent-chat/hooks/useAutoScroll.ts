import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoScrollReturn {
	containerRef: React.RefObject<HTMLDivElement | null>;
	scrollToBottom: () => void;
	isAtBottom: boolean;
}

/**
 * Auto-scroll management for the message list.
 *
 * - Scrolls to bottom on new messages when user is at the bottom
 * - Pauses auto-scroll when user scrolls up
 * - Resumes when user scrolls back within 50px of the bottom
 * - Always scrolls on own message send (call scrollToBottom explicitly)
 */
export function useAutoScroll(messageCount: number): UseAutoScrollReturn {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);

	const scrollToBottom = useCallback(() => {
		const el = containerRef.current;
		if (!el) return;
		el.scrollTo?.({ top: el.scrollHeight, behavior: "smooth" });
		setIsAtBottom(true);
	}, []);

	// Track scroll position
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const handleScroll = () => {
			const threshold = 50;
			const atBottom =
				el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
			setIsAtBottom(atBottom);
		};

		el.addEventListener("scroll", handleScroll, { passive: true });
		return () => el.removeEventListener("scroll", handleScroll);
	}, []);

	// Auto-scroll on new messages when at bottom
	useEffect(() => {
		if (isAtBottom && messageCount > 0) {
			const el = containerRef.current;
			if (el) {
				el.scrollTo?.({ top: el.scrollHeight, behavior: "smooth" });
			}
		}
	}, [messageCount, isAtBottom]);

	return { containerRef, scrollToBottom, isAtBottom };
}
