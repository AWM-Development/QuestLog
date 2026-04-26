import type { Editor, JSONContent } from "@tiptap/core";
import { getMarkRange } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "../../../../components/buttons/IconButton.js";
import {
	editorSurface,
	floatingMenu,
	floatingMenuDropdown,
	floatingMenuOption,
} from "../../../../components/styles.js";
import { EntityHighlight } from "../../extensions/EntityHighlight.js";
import { useEntityDetection } from "../../hooks/useEntityDetection.js";
import type { EntitySpan, EntityType } from "../../types.js";
import "./../../styles/entity-highlight.css";
import { DetectedEntitiesPanel } from "./DetectedEntitiesPanel.js";
import { EntityActionBar, useActionBar } from "./EntityActionBar.js";
import { EntityQuickCreatePopover } from "./EntityQuickCreatePopover.js";

function parseInitialContent(raw: string): JSONContent | undefined {
	if (!raw.trim()) {
		return undefined;
	}
	try {
		return JSON.parse(raw) as JSONContent;
	} catch {
		return {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: raw }],
				},
			],
		};
	}
}

function slashShouldShow({ editor }: { editor: Editor }) {
	const { state } = editor;
	const { $from } = state.selection;
	const start = $from.start();
	const text = state.doc.textBetween(start, $from.pos, "\n", "\0");
	return text === "/";
}

function deleteSlashAndRun(editor: Editor, run: () => void) {
	const { state } = editor;
	const { $from } = state.selection;
	const pos = $from.pos;
	editor
		.chain()
		.focus()
		.deleteRange({ from: pos - 1, to: pos })
		.run();
	run();
}

function cycleHeading(editor: Editor) {
	if (editor.isActive("heading", { level: 2 })) {
		editor.chain().focus().toggleHeading({ level: 3 }).run();
	} else if (editor.isActive("heading", { level: 3 })) {
		editor.chain().focus().setParagraph().run();
	} else {
		editor.chain().focus().toggleHeading({ level: 2 }).run();
	}
}

const SLASH_MENU_ITEMS: { label: string; run: (ed: Editor) => void }[] = [
	{
		label: "Heading 2",
		run: (ed) =>
			deleteSlashAndRun(ed, () => {
				ed.chain().focus().toggleHeading({ level: 2 }).run();
			}),
	},
	{
		label: "Heading 3",
		run: (ed) =>
			deleteSlashAndRun(ed, () => {
				ed.chain().focus().toggleHeading({ level: 3 }).run();
			}),
	},
	{
		label: "Bullet list",
		run: (ed) =>
			deleteSlashAndRun(ed, () => {
				ed.chain().focus().toggleBulletList().run();
			}),
	},
	{
		label: "Numbered list",
		run: (ed) =>
			deleteSlashAndRun(ed, () => {
				ed.chain().focus().toggleOrderedList().run();
			}),
	},
	{
		label: "Quote",
		run: (ed) =>
			deleteSlashAndRun(ed, () => {
				ed.chain().focus().toggleBlockquote().run();
			}),
	},
	{
		label: "Code block",
		run: (ed) =>
			deleteSlashAndRun(ed, () => {
				ed.chain().focus().toggleCodeBlock().run();
			}),
	},
	{
		label: "Horizontal rule",
		run: (ed) =>
			deleteSlashAndRun(ed, () => {
				ed.chain().focus().setHorizontalRule().run();
			}),
	},
];

interface PopoverState {
	spanText: string;
	initialType: EntityType;
	position: { top: number; left: number };
	markRange: { from: number; to: number };
}

interface SessionEditorProps {
	sessionId: string;
	campaignId: string;
	content: string;
	placeholder: string;
	onContentChange: (json: string) => void;
	onEditorReady?: (editor: Editor) => void;
	onUnresolvedCountChange?: (count: number) => void;
	initialDismissedEntityTexts?: string[];
	onDismissedEntityTextsChange?: (texts: string[]) => void;
}

export function SessionEditor({
	sessionId,
	campaignId,
	content,
	placeholder,
	onContentChange,
	onEditorReady,
	onUnresolvedCountChange,
	initialDismissedEntityTexts,
	onDismissedEntityTextsChange,
}: SessionEditorProps) {
	const [slashHighlightIndex, setSlashHighlightIndex] = useState(0);
	const slashHighlightRef = useRef(0);
	slashHighlightRef.current = slashHighlightIndex;
	const prevSlashVisible = useRef(false);
	const onContentChangeRef = useRef(onContentChange);
	onContentChangeRef.current = onContentChange;
	const onEditorReadyRef = useRef(onEditorReady);
	onEditorReadyRef.current = onEditorReady;
	const onDismissedEntityTextsChangeRef = useRef(onDismissedEntityTextsChange);
	onDismissedEntityTextsChangeRef.current = onDismissedEntityTextsChange;

	const dismissedRef = useRef<string[]>(initialDismissedEntityTexts ?? []);
	useEffect(() => {
		// Sync inbound changes (e.g. after server roundtrip) without recreating editor.
		dismissedRef.current = initialDismissedEntityTexts ?? [];
	}, [initialDismissedEntityTexts]);

	const editorContainerRef = useRef<HTMLDivElement>(null);
	const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
	const [popover, setPopover] = useState<PopoverState | null>(null);

	const { detectedSpans, unresolvedCount, scanParagraph, scanFullDocument } =
		useEntityDetection({
			editor: editorInstance,
			campaignId,
			dismissedRef,
		});

	const onUnresolvedCountChangeRef = useRef(onUnresolvedCountChange);
	onUnresolvedCountChangeRef.current = onUnresolvedCountChange;
	useEffect(() => {
		onUnresolvedCountChangeRef.current?.(unresolvedCount);
	}, [unresolvedCount]);

	const actionBar = useActionBar({
		editorRef: editorContainerRef,
		onDismiss: () => {},
	});

	const handleDismiss = useCallback(
		(text: string) => {
			const normalized = text.toLowerCase();
			if (!dismissedRef.current.includes(normalized)) {
				dismissedRef.current = [...dismissedRef.current, normalized];
				onDismissedEntityTextsChangeRef.current?.(dismissedRef.current);
			}
			actionBar.hide();
			if (!editorInstance) return;
			// Re-scan to drop the now-dismissed span. Cheap for typical session sizes.
			scanFullDocument();
		},
		[actionBar, editorInstance, scanFullDocument],
	);

	const openPopoverForRange = useCallback(
		(range: { from: number; to: number }, initialType: EntityType = "npc") => {
			const ed = editorInstance;
			if (!ed) return;
			const text = ed.state.doc.textBetween(range.from, range.to);
			if (!text.trim()) return;
			const containerRect = editorContainerRef.current?.getBoundingClientRect();
			let top = 0;
			let left = 0;
			try {
				const start = ed.view.coordsAtPos(range.from);
				const end = ed.view.coordsAtPos(range.to);
				if (containerRect) {
					top = end.bottom - containerRect.top + 6;
					left = start.left - containerRect.left;
				}
			} catch {
				// Position lookup can fail on freshly-mounted editors; default to (0,0).
			}
			setPopover({
				spanText: text,
				initialType,
				position: { top, left },
				markRange: range,
			});
		},
		[editorInstance],
	);

	const handleActionBarCreate = useCallback(() => {
		const ed = editorInstance;
		if (!ed) return;
		const { from, to, entityType } = actionBar.state;
		actionBar.hide();
		if (from >= to) return;
		openPopoverForRange(
			{ from, to },
			(entityType as EntityType | null) ?? "npc",
		);
	}, [actionBar, editorInstance, openPopoverForRange]);

	const handlePopoverCreated = useCallback(
		(entity: { id: string; name: string; type: string }) => {
			const ed = editorInstance;
			const range = popover?.markRange;
			setPopover(null);
			if (!ed || !range) return;
			const markType = ed.schema.marks.entityHighlight;
			if (!markType) return;
			const tr = ed.state.tr;
			tr.removeMark(range.from, range.to, markType);
			tr.addMark(
				range.from,
				range.to,
				markType.create({
					entityId: entity.id,
					entityType: entity.type,
					state: "confirmed",
					candidates: "[]",
				}),
			);
			ed.view.dispatch(tr);
			scanFullDocument();
		},
		[editorInstance, popover, scanFullDocument],
	);

	const handleScrollToSpan = useCallback(
		(span: EntitySpan) => {
			const ed = editorInstance;
			if (!ed) return;
			ed.commands.focus();
			ed.commands.setTextSelection({
				from: span.startIndex,
				to: span.endIndex,
			});
			ed.commands.scrollIntoView();
		},
		[editorInstance],
	);

	const handleActivateActionBar = useCallback(
		(span: EntitySpan) => {
			handleScrollToSpan(span);
			// The hover handler will pick this up after focus; to be deterministic,
			// open the popover directly for unresolved spans.
			openPopoverForRange(
				{ from: span.startIndex, to: span.endIndex },
				span.entityType,
			);
		},
		[handleScrollToSpan, openPopoverForRange],
	);

	const editor = useEditor(
		{
			extensions: [
				StarterKit.configure({
					heading: { levels: [2, 3] },
					link: { openOnClick: false },
				}),
				Placeholder.configure({
					placeholder,
				}),
				EntityHighlight,
			],
			content: parseInitialContent(content),
			editorProps: {
				attributes: {
					class: "session-editor-root",
					style: [
						"font-family: var(--font-body)",
						"font-size: 0.875rem",
						"line-height: 1.75",
						"color: var(--text-primary)",
						"outline: none",
					].join("; "),
				},
			},
			onCreate: ({ editor: ed }) => {
				setEditorInstance(ed);
				onEditorReadyRef.current?.(ed);
			},
			onUpdate: ({ editor: ed, transaction }) => {
				onContentChangeRef.current(JSON.stringify(ed.getJSON()));
				// Skip our own setEntitySpans transactions (they have no docChanged
				// content beyond mark changes, but we don't want to feedback-loop).
				if (transaction.getMeta("addToHistory") === false) return;
				if (!transaction.docChanged) return;
				// Find paragraphs touched by this transaction and re-scan them.
				const touched = new Set<number>();
				const { doc } = ed.state;
				for (const stepMap of transaction.mapping.maps) {
					stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
						doc.nodesBetween(newStart, newEnd, (node, pos) => {
							if (node.isTextblock) {
								touched.add(pos + 1);
								return false;
							}
							return undefined;
						});
					});
				}
				for (const paragraphPos of touched) {
					scanParagraph(paragraphPos);
				}
			},
			onDestroy: () => {
				setEditorInstance(null);
			},
		},
		[sessionId],
	);

	// Initial scan once editor is ready (also handles orphaned marks).
	useEffect(() => {
		if (!editorInstance) return;
		scanFullDocument();
	}, [editorInstance, scanFullDocument]);

	useEffect(() => {
		if (!editor) return;
		const onTransaction = () => {
			const now = slashShouldShow({ editor });
			if (now && !prevSlashVisible.current) {
				setSlashHighlightIndex(0);
			}
			prevSlashVisible.current = now;
		};
		editor.on("transaction", onTransaction);
		return () => {
			editor.off("transaction", onTransaction);
		};
	}, [editor]);

	useEffect(() => {
		if (!editor) return;
		const max = SLASH_MENU_ITEMS.length - 1;
		const onKeyDown = (e: KeyboardEvent) => {
			if (!slashShouldShow({ editor })) return;
			if (e.key === "ArrowDown") {
				e.preventDefault();
				e.stopPropagation();
				setSlashHighlightIndex((i) => Math.min(i + 1, max));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				e.stopPropagation();
				setSlashHighlightIndex((i) => Math.max(i - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				e.stopPropagation();
				const item = SLASH_MENU_ITEMS[slashHighlightRef.current];
				if (item) item.run(editor);
				setSlashHighlightIndex(0);
				prevSlashVisible.current = false;
			} else if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				const { state } = editor;
				const { $from } = state.selection;
				const pos = $from.pos;
				editor
					.chain()
					.focus()
					.deleteRange({ from: pos - 1, to: pos })
					.run();
				prevSlashVisible.current = false;
			}
		};
		const dom = editor.view.dom as HTMLElement;
		dom.addEventListener("keydown", onKeyDown, true);
		return () => dom.removeEventListener("keydown", onKeyDown, true);
	}, [editor]);

	// Hover detection on entity spans → open action bar.
	useEffect(() => {
		if (!editor) return;
		const dom = editor.view.dom as HTMLElement;
		const onMouseOver = (e: MouseEvent) => {
			const target = (e.target as HTMLElement | null)?.closest(
				"span[data-entity-state]",
			) as HTMLElement | null;
			if (!target) return;
			let from = 0;
			let to = 0;
			try {
				from = editor.view.posAtDOM(target, 0);
				const $pos = editor.state.doc.resolve(from);
				const markType = editor.schema.marks.entityHighlight;
				if (!markType) return;
				const range = getMarkRange($pos, markType);
				if (!range) return;
				from = range.from;
				to = range.to;
			} catch {
				return;
			}
			const text = editor.state.doc.textBetween(from, to);
			const entityId = target.dataset.entityId ?? null;
			const entityType =
				(target.dataset.entityType as EntityType | undefined) ?? null;
			actionBar.showForSpan(target, text, entityId, entityType, from, to);
		};
		const onMouseOut = (e: MouseEvent) => {
			const related = e.relatedTarget as HTMLElement | null;
			if (related?.closest("[data-action-bar]")) return;
			const leaving = (e.target as HTMLElement | null)?.closest(
				"span[data-entity-state]",
			);
			if (!leaving) return;
			actionBar.scheduleHide();
		};
		dom.addEventListener("mouseover", onMouseOver);
		dom.addEventListener("mouseout", onMouseOut);
		return () => {
			dom.removeEventListener("mouseover", onMouseOver);
			dom.removeEventListener("mouseout", onMouseOut);
		};
	}, [editor, actionBar]);

	if (!editor) {
		return null;
	}

	const handleEntityBubbleMenu = () => {
		const { from, to } = editor.state.selection;
		if (from >= to) return;
		// Apply unlinked mark first so the popover can reuse the range.
		editor.commands.setEntityMark({
			entityId: null,
			entityType: null,
			state: "unlinked",
			candidates: "[]",
		});
		openPopoverForRange({ from, to }, "npc");
	};

	return (
		<div
			ref={editorContainerRef}
			style={{
				...editorSurface,
				padding: 0,
				display: "flex",
				flexDirection: "column",
				position: "relative",
			}}
		>
			<BubbleMenu editor={editor}>
				<div style={floatingMenu}>
					<IconButton
						label="Bold"
						size={24}
						onClick={() => editor.chain().focus().toggleBold().run()}
					>
						B
					</IconButton>
					<IconButton
						label="Italic"
						size={24}
						onClick={() => editor.chain().focus().toggleItalic().run()}
					>
						I
					</IconButton>
					<IconButton
						label="Strikethrough"
						size={24}
						onClick={() => editor.chain().focus().toggleStrike().run()}
					>
						S
					</IconButton>
					<IconButton
						label="Code"
						size={24}
						onClick={() => editor.chain().focus().toggleCode().run()}
					>
						{"</>"}
					</IconButton>
					<IconButton
						label="Link"
						size={24}
						onClick={() => {
							const href = window.prompt("Link URL");
							if (href) editor.chain().focus().setLink({ href }).run();
						}}
					>
						🔗
					</IconButton>
					<IconButton
						label="Heading"
						size={24}
						onClick={() => cycleHeading(editor)}
					>
						H
					</IconButton>
					<IconButton label="Entity" size={24} onClick={handleEntityBubbleMenu}>
						⬡
					</IconButton>
				</div>
			</BubbleMenu>

			<FloatingMenu editor={editor} shouldShow={slashShouldShow}>
				<div style={floatingMenuDropdown}>
					{SLASH_MENU_ITEMS.map((item, index) => (
						<button
							key={item.label}
							type="button"
							style={{
								...floatingMenuOption,
								width: "100%",
								border: "none",
								background:
									index === slashHighlightIndex
										? "var(--state-active-soft)"
										: "transparent",
								textAlign: "left",
							}}
							onMouseEnter={() => setSlashHighlightIndex(index)}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => item.run(editor)}
						>
							{item.label}
						</button>
					))}
				</div>
			</FloatingMenu>

			<EditorContent editor={editor} style={{ flex: 1, minHeight: 0 }} />

			{actionBar.state.visible && editorInstance ? (
				<EntityActionBar
					spanText={actionBar.state.spanText}
					entityId={actionBar.state.entityId}
					entityType={actionBar.state.entityType}
					campaignId={campaignId}
					position={actionBar.state.position}
					onDismiss={(text) => handleDismiss(text)}
					onCreate={handleActionBarCreate}
					onLink={() => actionBar.hide()}
					onClose={() => actionBar.hide()}
					onBarMouseEnter={() => actionBar.setBarHovered(true)}
					onBarMouseLeave={() => actionBar.setBarHovered(false)}
				/>
			) : null}

			{popover ? (
				<EntityQuickCreatePopover
					spanText={popover.spanText}
					initialType={popover.initialType}
					campaignId={campaignId}
					position={popover.position}
					onCreated={handlePopoverCreated}
					onClose={() => setPopover(null)}
				/>
			) : null}

			<DetectedEntitiesPanel
				detectedSpans={detectedSpans}
				onScrollToSpan={handleScrollToSpan}
				onActivateActionBar={handleActivateActionBar}
			/>
		</div>
	);
}
