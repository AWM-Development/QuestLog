import type { Editor, JSONContent } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "../../../../components/buttons/IconButton.js";
import {
	editorSurface,
	floatingMenu,
	floatingMenuDropdown,
	floatingMenuOption,
} from "../../../../components/styles.js";
import { EntityHighlight } from "../../extensions/EntityHighlight.js";
import { useEntityDetection } from "../../hooks/useEntityDetection.js";
import type { EntitySpan } from "../../types.js";
import "./../../styles/entity-highlight.css";
import { DetectedEntitiesPanel } from "./DetectedEntitiesPanel.js";

function parseInitialContent(raw: string): JSONContent | string {
	if (!raw.trim()) {
		return "";
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

interface SessionEditorProps {
	sessionId: string;
	campaignId: string;
	content: string;
	placeholder: string;
	onContentChange: (json: string) => void;
	onEditorReady?: (editor: Editor) => void;
}

export function SessionEditor({
	sessionId,
	campaignId,
	content,
	placeholder,
	onContentChange,
	onEditorReady,
}: SessionEditorProps) {
	const [slashHighlightIndex, setSlashHighlightIndex] = useState(0);
	const slashHighlightRef = useRef(0);
	slashHighlightRef.current = slashHighlightIndex;
	const prevSlashVisible = useRef(false);
	const onContentChangeRef = useRef(onContentChange);
	onContentChangeRef.current = onContentChange;
	const onEditorReadyRef = useRef(onEditorReady);
	onEditorReadyRef.current = onEditorReady;
	const dismissedRef = useRef<string[]>([]);

	const { detectedSpans, onEditorUpdate } = useEntityDetection({
		campaignId,
		dismissedEntityTexts: dismissedRef.current,
	});

	const handleScrollToSpan = (span: EntitySpan) => {
		if (!editor) return;
		editor.commands.focus();
		editor.commands.setTextSelection(span.startIndex);
	};

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
				EntityHighlight.configure({
					campaignId,
					dismissedRef,
					onDismiss: () => {},
				}),
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
				onEditorReadyRef.current?.(ed);
			},
			onUpdate: ({ editor: ed }) => {
				onContentChangeRef.current(JSON.stringify(ed.getJSON()));
				const text = ed.getText();
				onEditorUpdate(text, 0, text.length);
			},
		},
		[sessionId],
	);

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

	if (!editor) {
		return null;
	}

	return (
		<div
			style={{
				...editorSurface,
				padding: 0,
				display: "flex",
				flexDirection: "column",
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
					<IconButton
						label="Entity"
						size={24}
						onClick={() => {
							editor.commands.setEntityMark({
								entityId: null,
								entityType: null,
								state: "unlinked",
								candidates: "[]",
							});
						}}
					>
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
			<DetectedEntitiesPanel
				detectedSpans={detectedSpans}
				onScrollToSpan={handleScrollToSpan}
				onActivateActionBar={() => {}}
			/>
		</div>
	);
}
