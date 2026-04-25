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
}

const barStyle: CSSProperties = {
	position: "absolute",
	background: "var(--bg-focal)",
	border: "1px solid var(--border-hover)",
	borderRadius: 5,
	display: "flex",
	whiteSpace: "nowrap",
	overflow: "hidden",
	boxShadow: "0 8px 24px rgba(4, 12, 24, 0.6)",
	zIndex: 100,
};

const btnBase: CSSProperties = {
	padding: "4px 10px",
	fontSize: 10,
	cursor: "pointer",
	background: "transparent",
	border: "none",
	borderRight: "1px solid var(--border)",
};

const linkBtnStyle: CSSProperties = {
	...btnBase,
	color: "var(--text-secondary)",
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
}: EntityActionBarProps) {
	const barRef = useRef<HTMLDivElement>(null);

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
			ref={barRef}
			role="toolbar"
			style={{
				...barStyle,
				top: position.top,
				left: position.left,
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					e.preventDefault();
					onClose();
				}
			}}
		>
			<button
				type="button"
				aria-label="Link entity"
				style={linkBtnStyle}
				onClick={() => {}}
			>
				Link
			</button>
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
	position: { top: number; left: number };
	placement: "above" | "below";
}

export function useActionBar({
	editorRef,
	onDismiss: _onDismiss,
}: UseActionBarOptions) {
	const [state, setState] = useState<ActionBarState>({
		visible: false,
		spanText: "",
		entityId: null,
		entityType: null,
		position: { top: 0, left: 0 },
		placement: "above",
	});
	const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isHoveredRef = useRef(false);

	const showForSpan = (
		spanEl: HTMLElement,
		spanText: string,
		entityId: string | null,
		entityType: EntityType | null,
	) => {
		isHoveredRef.current = true;
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
				position: { top, left: spanRect.left - editorRect.left },
				placement,
			});
		}, 80);
	};

	const hide = () => {
		isHoveredRef.current = false;
		if (showTimerRef.current) clearTimeout(showTimerRef.current);
		setState((prev) => ({ ...prev, visible: false }));
	};

	const setBarHovered = (hovered: boolean) => {
		isHoveredRef.current = hovered;
		if (!hovered) hide();
	};

	return { state, showForSpan, hide, setBarHovered };
}
