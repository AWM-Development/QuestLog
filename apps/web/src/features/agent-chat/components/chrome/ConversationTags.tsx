import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Input } from "../../../../components/inputs/Input.js";
import { chatPillButton } from "../../styles.js";
import { getTagColor } from "../../types.js";

interface ConversationTagsProps {
	tags: string[];
	allTags: string[];
	onUpdateTags: (tags: string[]) => void;
}

const tagPillStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	borderRadius: "var(--r-sm)",
	fontFamily: "var(--font-body)",
	gap: "var(--space-1)",
	fontSize: "10px",
	padding: "var(--space-1) var(--space-2)",
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
	...chatPillButton,
};

const popoverStyle: CSSProperties = {
	position: "absolute",
	top: 0,
	left: 0,
	width: "220px",
	background: "var(--bg-focal)",
	border: "0.5px solid var(--border)",
	borderRadius: "var(--r-md)",
	padding: "var(--space-2)",
	boxShadow: "var(--shadow-focal)",
	zIndex: 30,
};

const popoverInputStyle: CSSProperties = {
	width: "100%",
	padding: "var(--space-2)",
	boxSizing: "border-box",
};

const suggestionStyle: CSSProperties = {
	padding: "var(--space-2)",
	fontSize: "11px",
	color: "var(--text-secondary)",
	cursor: "pointer",
	borderRadius: "var(--r-sm)",
	border: "none",
	background: "transparent",
	width: "100%",
	textAlign: "left",
	display: "block",
	transition: "background 100ms ease",
};

export function ConversationTags({
	tags,
	allTags,
	onUpdateTags,
}: ConversationTagsProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
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
	const options = [...filtered, ...(showCreate ? [search.trim()] : [])];

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "var(--space-1)",
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
				{!open && (
					<button
						type="button"
						style={addButtonStyle}
						aria-label="Add tag"
						onClick={() => {
							setOpen(true);
							setActiveIndex(0);
						}}
					>
						+ tag
					</button>
				)}

				{open && (
					<div style={popoverStyle}>
						<Input
							size="sm"
							type="text"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setActiveIndex(0);
							}}
							placeholder="Add or create tag..."
							style={popoverInputStyle}
							autoFocus
							onKeyDown={(e) => {
								if (!options.length) return;
								if (e.key === "ArrowDown") {
									e.preventDefault();
									setActiveIndex((idx) =>
										Math.min(idx + 1, options.length - 1),
									);
									return;
								}
								if (e.key === "ArrowUp") {
									e.preventDefault();
									setActiveIndex((idx) => Math.max(idx - 1, 0));
									return;
								}
								if (e.key === "Enter") {
									e.preventDefault();
									addTag(options[activeIndex] ?? options[0] ?? "");
								}
							}}
						/>
						<div
							style={{
								marginTop: "var(--space-1)",
								maxHeight: "120px",
								overflowY: "auto",
							}}
						>
							{filtered.map((tag, index) => (
								<button
									key={tag}
									style={{
										...suggestionStyle,
										background:
											activeIndex === index
												? "var(--bg-elevated)"
												: "transparent",
									}}
									onFocus={() => setActiveIndex(index)}
									onClick={() => addTag(tag)}
									onMouseEnter={() => setActiveIndex(index)}
									type="button"
									aria-label={`Add tag ${tag}`}
									tabIndex={-1}
								>
									{tag}
								</button>
							))}
							{showCreate && (
								<button
									style={{
										...suggestionStyle,
										color: "var(--accent)",
										background:
											activeIndex === filtered.length
												? "var(--bg-elevated)"
												: "transparent",
										width: "100%",
										textAlign: "left",
										border: "none",
									}}
									onClick={() => addTag(search.trim())}
									onMouseEnter={() => setActiveIndex(filtered.length)}
									type="button"
									aria-label={`Create tag ${search.trim()}`}
									tabIndex={-1}
								>
									+ Create &ldquo;{search.trim()}&rdquo;
								</button>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
