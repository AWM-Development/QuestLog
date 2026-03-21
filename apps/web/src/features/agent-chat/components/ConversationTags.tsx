import { type CSSProperties, useEffect, useRef, useState } from "react";
import { getTagColor } from "../types.js";

interface ConversationTagsProps {
	tags: string[];
	allTags: string[];
	onUpdateTags: (tags: string[]) => void;
}

const tagPillStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "3px",
	fontSize: "10px",
	borderRadius: "var(--r-sm)",
	padding: "2px 7px",
	fontFamily: "var(--font-body)",
};

const removeButtonStyle: CSSProperties = {
	background: "none",
	border: "none",
	cursor: "pointer",
	fontSize: "9px",
	padding: 0,
	lineHeight: 1,
	opacity: 0.6,
};

const addButtonStyle: CSSProperties = {
	fontSize: "10px",
	borderRadius: "var(--r-sm)",
	padding: "2px 7px",
	border: "1px dashed var(--border)",
	background: "transparent",
	color: "var(--text-dim)",
	cursor: "pointer",
	fontFamily: "var(--font-body)",
	transition: "all 150ms ease",
};

const popoverStyle: CSSProperties = {
	position: "absolute",
	top: "100%",
	left: 0,
	marginTop: "4px",
	width: "220px",
	background: "var(--bg-focal)",
	border: "0.5px solid var(--border)",
	borderRadius: "var(--r-md)",
	padding: "8px",
	boxShadow: "0 12px 40px rgba(4, 12, 24, 0.8)",
	zIndex: 30,
};

const popoverInputStyle: CSSProperties = {
	width: "100%",
	background: "var(--bg-elevated)",
	border: "1px solid var(--border)",
	borderRadius: "var(--r-sm)",
	padding: "6px 8px",
	fontSize: "11px",
	color: "var(--text-primary)",
	outline: "none",
	fontFamily: "var(--font-body)",
	boxSizing: "border-box",
};

const suggestionStyle: CSSProperties = {
	padding: "5px 8px",
	fontSize: "11px",
	color: "var(--text-secondary)",
	cursor: "pointer",
	borderRadius: "var(--r-sm)",
	transition: "background 100ms ease",
};

export function ConversationTags({
	tags,
	allTags,
	onUpdateTags,
}: ConversationTagsProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const popoverRef = useRef<HTMLDivElement>(null);

	// Close on outside click or Escape
	useEffect(() => {
		if (!open) return;
		const handleClick = (e: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		};
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKey);
		};
	}, [open]);

	const removeTag = (tag: string) => {
		onUpdateTags(tags.filter((t) => t !== tag));
	};

	const addTag = (tag: string) => {
		if (!tags.includes(tag) && tags.length < 10) {
			onUpdateTags([...tags, tag]);
		}
		setSearch("");
		setOpen(false);
	};

	const filtered = allTags
		.filter((t) => !tags.includes(t))
		.filter((t) => t.toLowerCase().includes(search.toLowerCase()));

	const showCreate =
		search.trim() &&
		!allTags.includes(search.trim()) &&
		!tags.includes(search.trim());

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "4px",
				position: "relative",
			}}
		>
			{tags.map((tag) => {
				const color = getTagColor(tag);
				return (
					<span
						key={tag}
						style={{
							...tagPillStyle,
							background: color.bg,
							color: color.text,
						}}
					>
						{tag}
						<button
							type="button"
							style={{ ...removeButtonStyle, color: color.text }}
							onClick={() => removeTag(tag)}
							aria-label={`Remove tag ${tag}`}
						>
							&#x00D7;
						</button>
					</span>
				);
			})}

			<div ref={popoverRef} style={{ position: "relative" }}>
				<button
					type="button"
					style={addButtonStyle}
					onClick={() => setOpen(!open)}
				>
					+ tag
				</button>

				{open && (
					<div style={popoverStyle}>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Add or create tag..."
							style={popoverInputStyle}
							// biome-ignore lint/a11y/noAutofocus: tag popover input should auto-focus
							autoFocus
							onKeyDown={(e) => {
								if (e.key === "Enter" && showCreate) {
									addTag(search.trim());
								}
							}}
						/>
						<div
							style={{
								marginTop: "4px",
								maxHeight: "120px",
								overflowY: "auto",
							}}
							role="listbox"
						>
							{filtered.map((tag) => (
								<div
									key={tag}
									style={suggestionStyle}
									onClick={() => addTag(tag)}
									onKeyDown={(e) => {
										if (e.key === "Enter") addTag(tag);
									}}
									// biome-ignore lint/a11y/useSemanticElements: custom dropdown option in non-native select
									role="option"
									aria-selected={false}
									tabIndex={0}
								>
									{tag}
								</div>
							))}
							{showCreate && (
								<div
									style={{
										...suggestionStyle,
										color: "var(--accent)",
									}}
									onClick={() => addTag(search.trim())}
									onKeyDown={(e) => {
										if (e.key === "Enter") addTag(search.trim());
									}}
									// biome-ignore lint/a11y/useSemanticElements: custom dropdown option in non-native select
									role="option"
									aria-selected={false}
									tabIndex={0}
								>
									+ Create &ldquo;{search.trim()}&rdquo;
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
