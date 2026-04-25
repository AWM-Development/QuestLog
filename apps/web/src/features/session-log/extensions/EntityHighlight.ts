import { Mark } from "@tiptap/core";
import type React from "react";

export type EntityState = "confirmed" | "ambiguous" | "unlinked";

export interface EntityHighlightOptions {
	campaignId: string;
	dismissedRef: React.MutableRefObject<string[]>;
	onDismiss: (text: string) => void;
}

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		entityHighlight: {
			setEntitySpans: (
				spans: Array<{
					entityId: string;
					entityName: string;
					entityType: string;
					startIndex: number;
					endIndex: number;
					matchType: "confirmed" | "ambiguous";
					candidates: { id: string; name: string }[];
				}>,
				paragraphFrom: number,
				paragraphTo: number,
			) => ReturnType;
			setEntityMark: (attrs: {
				entityId: string | null;
				entityType: string | null;
				state: EntityState;
				candidates: string;
			}) => ReturnType;
		};
	}
}

export const EntityHighlight = Mark.create<EntityHighlightOptions>({
	name: "entityHighlight",

	addOptions() {
		return {
			campaignId: "",
			dismissedRef: { current: [] },
			onDismiss: () => {},
		};
	},

	addAttributes() {
		return {
			entityId: { default: null },
			entityType: { default: null },
			state: { default: "unlinked" },
			candidates: { default: "[]" },
		};
	},

	parseHTML() {
		return [
			{
				tag: "span[data-entity-state]",
				getAttrs: (node) => {
					if (typeof node === "string") return {};
					const el = node as HTMLElement;
					return {
						entityId: el.getAttribute("data-entity-id"),
						entityType: el.getAttribute("data-entity-type"),
						state: el.getAttribute("data-entity-state") ?? "unlinked",
						candidates: el.getAttribute("data-entity-candidates") ?? "[]",
					};
				},
			},
		];
	},

	renderHTML({ mark, HTMLAttributes: _attrs }) {
		const { entityId, entityType, state, candidates } = mark.attrs as {
			entityId: string | null;
			entityType: string | null;
			state: EntityState;
			candidates: string;
		};

		const classes = ["entity-span", `entity-span--${state}`];
		if (entityType) {
			classes.push(`entity-span--${entityType}`);
		}

		return [
			"span",
			{
				class: classes.join(" "),
				"data-entity-state": state,
				"data-entity-id": entityId ?? undefined,
				"data-entity-type": entityType ?? undefined,
				"data-entity-candidates": candidates,
			},
			0,
		];
	},

	addCommands() {
		return {
			setEntitySpans:
				(spans, paragraphFrom, paragraphTo) =>
				({ tr, state, dispatch }) => {
					if (!dispatch) return true;

					// Remove existing entity marks from the paragraph range
					const { doc } = tr;
					const markType = state.schema.marks.entityHighlight;
					if (!markType) return true;

					doc.nodesBetween(paragraphFrom, paragraphTo, (node, pos) => {
						if (node.isText && node.marks.some((m) => m.type === markType)) {
							tr.removeMark(pos, pos + node.nodeSize, markType);
						}
					});

					// Apply new marks
					for (const span of spans) {
						const from = paragraphFrom + span.startIndex;
						const to = paragraphFrom + span.endIndex;
						if (from >= to || to > paragraphTo) continue;
						const mark = markType.create({
							entityId: span.entityId,
							entityType: span.entityType,
							state: span.matchType,
							candidates: JSON.stringify(span.candidates),
						});
						tr.addMark(from, to, mark);
					}

					dispatch(tr);
					return true;
				},

			setEntityMark:
				(attrs) =>
				({ commands }) => {
					return commands.setMark("entityHighlight", attrs);
				},
		};
	},
});
