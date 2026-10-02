import type { DependencyChip } from "../utils/columns.js";

const ICON_PROPS = {
	width: 9,
	height: 9,
	viewBox: "0 0 16 16",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.5,
	strokeLinecap: "round",
	strokeLinejoin: "round",
} as const;

export function ChipView({ chip }: { chip: DependencyChip }) {
	return (
		<span className={`chip chip-${chip.kind}`}>
			{chip.kind === "gated" ? (
				<svg {...ICON_PROPS} aria-hidden="true">
					<rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
					<path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
				</svg>
			) : (
				<svg {...ICON_PROPS} aria-hidden="true">
					<circle cx="8" cy="8" r="5.5" />
					<path d="M4.5 4.5l7 7" />
				</svg>
			)}
			{chip.label}
		</span>
	);
}

const MAX_VISIBLE_CHIPS = 2;

/** Card-sized row: first two chips plus a `+N` overflow chip. The modal renders every chip itself. */
export function ChipRow({ chips }: { chips: DependencyChip[] }) {
	if (chips.length === 0) return null;
	const overflow = chips.length - MAX_VISIBLE_CHIPS;
	return (
		<span className="chip-row" data-testid="chip-row">
			{chips.slice(0, MAX_VISIBLE_CHIPS).map((c) => (
				<ChipView key={`${c.kind}-${c.label}`} chip={c} />
			))}
			{overflow > 0 && <span className="chip chip-more">+{overflow}</span>}
		</span>
	);
}
