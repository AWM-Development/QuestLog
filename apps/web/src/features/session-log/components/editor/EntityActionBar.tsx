import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { EntityType } from "../../types.js";

interface EntityActionBarProps {
	spanText: string;
	entityId: string | null;
	entityType: EntityType | null;
	campaignId: string;
	position: { top: number; left: number };
	onDismiss: (text: string) => void;
	onCreate: () => void;
	onLink: (entityId: string, entityType: EntityType) => void;
	onClose: () => void;
	onBarMouseEnter?: () => void;
	onBarMouseLeave?: () => void;
}

const barStyle: CSSProperties = {
	position: "absolute",
	background: "var(--bg-focal)",
	border: "1px solid var(--border-hover)",
	borderRadius: "var(--r-sm)",
	display: "flex",
	whiteSpace: "nowrap",
	overflow: "hidden",
	boxShadow: "var(--shadow-md)",
	zIndex: 100,
};

const btnBase: CSSProperties = {
	padding: "var(--space-1) var(--space-2-5)",
	fontSize: "0.625rem",
	cursor: "pointer",
	background: "transparent",
	border: "none",
	borderRight: "1px solid var(--border)",
};

const createBtnStyle: CSSProperties = {
	...btnBase,
	color: "var(--text-secondary)",
};

const dismissBtnStyle: CSSProperties = {
	...btnBase,
	color: "var(--status-error)",
	borderRight: "none",
};

export function EntityActionBar({
	spanText,
	entityId: _entityId,
	entityType: _entityType,
	campaignId: _campaignId,
	position,
	onDismiss,
	onCreate,
	onLink: _onLink,
	onClose,
	onBarMouseEnter,
	onBarMouseLeave,
}: EntityActionBarProps) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	return (
		<div
			role="toolbar"
			data-action-bar
			style={{
				...barStyle,
				top: position.top,
				left: position.left,
			}}
			onMouseEnter={onBarMouseEnter}
			onMouseLeave={onBarMouseLeave}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					onClose();
				}
			}}
		>
			<button
				type="button"
				aria-label="Create entity"
				style={createBtnStyle}
				onClick={onCreate}
			>
				Create
			</button>
			<button
				type="button"
				aria-label="Dismiss entity"
				style={dismissBtnStyle}
				onClick={() => onDismiss(spanText)}
			>
				Dismiss
			</button>
		</div>
	);
}

interface UseActionBarOptions {
	editorRef: React.RefObject<HTMLElement | null>;
	onDismiss: (text: string) => void;
}

interface ActionBarState {
	visible: boolean;
	spanText: string;
	entityId: string | null;
	entityType: EntityType | null;
	from: number;
	to: number;
	position: { top: number; left: number };
	placement: "above" | "below";
}

const HIDE_DELAY_MS = 120;
const SHOW_DELAY_MS = 80;

export function useActionBar({
	editorRef,
	onDismiss: _onDismiss,
}: UseActionBarOptions) {
	const [state, setState] = useState<ActionBarState>({
		visible: false,
		spanText: "",
		entityId: null,
		entityType: null,
		from: 0,
		to: 0,
		position: { top: 0, left: 0 },
		placement: "above",
	});
	const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isHoveredRef = useRef(false);

	const showForSpan = (
		spanEl: HTMLElement,
		spanText: string,
		entityId: string | null,
		entityType: EntityType | null,
		from: number,
		to: number,
	) => {
		isHoveredRef.current = true;
		if (hideTimerRef.current) {
			clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
		if (showTimerRef.current) clearTimeout(showTimerRef.current);

		showTimerRef.current = setTimeout(() => {
			if (!isHoveredRef.current) return;
			const editorRect = editorRef.current?.getBoundingClientRect();
			const spanRect = spanEl.getBoundingClientRect();
			if (!editorRect) return;

			const spanTopRelative = spanRect.top - editorRect.top;
			const placement = spanTopRelative < 60 ? "below" : "above";
			const top =
				placement === "above"
					? spanRect.top - editorRect.top - 36
					: spanRect.bottom - editorRect.top + 5;

			setState({
				visible: true,
				spanText,
				entityId,
				entityType,
				from,
				to,
				position: { top, left: spanRect.left - editorRect.left },
				placement,
			});
		}, SHOW_DELAY_MS);
	};

	const hide = () => {
		isHoveredRef.current = false;
		if (showTimerRef.current) clearTimeout(showTimerRef.current);
		if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		hideTimerRef.current = null;
		setState((prev) => ({ ...prev, visible: false }));
	};

	const scheduleHide = () => {
		isHoveredRef.current = false;
		if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		hideTimerRef.current = setTimeout(() => {
			if (!isHoveredRef.current) {
				setState((prev) => ({ ...prev, visible: false }));
			}
		}, HIDE_DELAY_MS);
	};

	const setBarHovered = (hovered: boolean) => {
		isHoveredRef.current = hovered;
		if (hovered && hideTimerRef.current) {
			clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
		if (!hovered) scheduleHide();
	};

	return { state, showForSpan, hide, scheduleHide, setBarHovered };
}
