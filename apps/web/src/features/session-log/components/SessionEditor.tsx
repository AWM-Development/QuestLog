import type { Editor, JSONContent } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
	editorSurface,
	floatingMenu,
	floatingMenuDropdown,
	floatingMenuOption,
	iconButtonBase,
} from "../../../components/styles.js";

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

interface SessionEditorProps {
	sessionId: string;
	content: string;
	placeholder: string;
	onContentChange: (json: string) => void;
}

export function SessionEditor({
	sessionId,
	content,
	placeholder,
	onContentChange,
}: SessionEditorProps) {
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
			onUpdate: ({ editor: ed }) => {
				onContentChange(JSON.stringify(ed.getJSON()));
			},
		},
		[sessionId],
	);

	if (!editor) {
		return null;
	}

	const slashItems: {
		label: string;
		run: (ed: Editor) => void;
	}[] = [
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

	return (
		<div style={{ ...editorSurface, display: "flex", flexDirection: "column" }}>
			<BubbleMenu editor={editor}>
				<div style={floatingMenu}>
					<button
						type="button"
						style={iconButtonBase}
						onClick={() => editor.chain().focus().toggleBold().run()}
						aria-label="Bold"
					>
						B
					</button>
					<button
						type="button"
						style={iconButtonBase}
						onClick={() => editor.chain().focus().toggleItalic().run()}
						aria-label="Italic"
					>
						I
					</button>
					<button
						type="button"
						style={iconButtonBase}
						onClick={() => editor.chain().focus().toggleStrike().run()}
						aria-label="Strikethrough"
					>
						S
					</button>
					<button
						type="button"
						style={iconButtonBase}
						onClick={() => editor.chain().focus().toggleCode().run()}
						aria-label="Code"
					>
						{"</>"}
					</button>
					<button
						type="button"
						style={iconButtonBase}
						onClick={() => {
							const href = window.prompt("Link URL");
							if (href) editor.chain().focus().setLink({ href }).run();
						}}
						aria-label="Link"
					>
						🔗
					</button>
					<button
						type="button"
						style={iconButtonBase}
						onClick={() => cycleHeading(editor)}
						aria-label="Heading"
					>
						H
					</button>
				</div>
			</BubbleMenu>

			<FloatingMenu editor={editor} shouldShow={slashShouldShow}>
				<div style={floatingMenuDropdown}>
					{slashItems.map((item) => (
						<button
							key={item.label}
							type="button"
							style={{
								...floatingMenuOption,
								width: "100%",
								border: "none",
								background: "transparent",
								textAlign: "left",
							}}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => item.run(editor)}
						>
							{item.label}
						</button>
					))}
				</div>
			</FloatingMenu>

			<EditorContent editor={editor} style={{ flex: 1, minHeight: 0 }} />
		</div>
	);
}
