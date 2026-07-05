import { type CSSProperties, useState } from "react";
import type { EntitySpan, EntityType } from "../../types.js";

const TYPE_LABELS: Record<EntityType, string> = {
	npc: "NPC",
	faction: "Faction",
	location: "Location",
	item: "Item",
	arc: "Arc",
};

interface EntityHoverCardProps {
	span: EntitySpan;
	onSelectCandidate: (candidate: { id: string; name: string }) => void;
	onCreateNew: () => void;
	onSkip: () => void;
}

const cardStyle: CSSProperties = {
	borderRadius: "var(--r-md)",
	overflow: "hidden",
	border: "1px solid var(--border-subtle)",
};

const kickerStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "var(--space-2)",
	padding: "var(--space-2) var(--space-3)",
	borderBottom: "1px solid var(--border-subtle)",
};

const kickerTextStyle: CSSProperties = {
	fontFamily: "var(--font-mono)",
	fontSize: "0.625rem",
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: "var(--text-muted)",
};

const ambiguousBadgeStyle: CSSProperties = {
	marginLeft: "auto",
	fontFamily: "var(--font-mono)",
	fontSize: "0.5rem",
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: "var(--status-warning)",
	padding: "2px 6px",
	borderRadius: "var(--r-pill)",
	border: "0.5px solid var(--status-warning)",
};

const bodyStyle: CSSProperties = {
	padding: "var(--space-3)",
};

const headingStyle: CSSProperties = {
	fontSize: "0.875rem",
	fontWeight: 600,
	color: "var(--text-primary)",
	marginBottom: "var(--space-1)",
};

const clarifyStyle: CSSProperties = {
	fontSize: "0.75rem",
	color: "var(--text-secondary)",
	lineHeight: 1.5,
	marginBottom: "var(--space-3)",
};

const candidateRowStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	padding: "var(--space-1-5) var(--space-2-5)",
	borderRadius: "var(--r-sm)",
	marginBottom: "var(--space-0-5)",
	cursor: "pointer",
	border: "none",
	width: "100%",
	textAlign: "left",
	fontSize: "0.8125rem",
	color: "var(--text-primary)",
	transition: "all 0.12s",
};

const footerStyle: CSSProperties = {
	display: "flex",
	gap: "var(--space-2)",
	padding: "var(--space-2) var(--space-3)",
	borderTop: "1px solid var(--border-subtle)",
};

const footerBtnStyle: CSSProperties = {
	flex: 1,
	padding: "var(--space-1-5) var(--space-2)",
	borderRadius: "var(--r-sm)",
	border: "0.5px solid var(--border)",
	backgroundColor: "transparent",
	cursor: "pointer",
	fontSize: "0.75rem",
	color: "var(--text-secondary)",
	transition: "all 0.15s",
};

export function EntityHoverCard({
	span,
	onSelectCandidate,
	onCreateNew,
	onSkip,
}: EntityHoverCardProps) {
	const [selectedIdx, setSelectedIdx] = useState(0);
	const entityType = span.entityType as EntityType;
	const typeLabel = TYPE_LABELS[entityType];
	const entColor = `var(--ent-${entityType})`;
	const cardBg = `color-mix(in srgb, ${entColor} 10%, var(--bg-focal))`;
	const cardBorder = `color-mix(in srgb, ${entColor} 30%, transparent)`;
	const preselectedBg = `color-mix(in srgb, ${entColor} 6%, transparent)`;

	return (
		<div
			data-testid="entity-hover-card"
			style={{ ...cardStyle, backgroundColor: cardBg, borderColor: cardBorder }}
		>
			<div style={kickerStyle}>
				<span
					data-testid="hover-card-kicker"
					style={{ ...kickerTextStyle, color: entColor }}
				>
					{typeLabel} · {span.candidates.length} CANDIDATES
				</span>
				<span style={ambiguousBadgeStyle}>AMBIGUOUS</span>
			</div>
			<div style={bodyStyle}>
				<p data-testid="hover-card-heading" style={headingStyle}>
					"{span.entityName}"
				</p>
				<p style={clarifyStyle}>
					Multiple matches found. Select the correct entity or create a new one.
				</p>
				{/* biome-ignore lint/a11y/useSemanticElements: custom-styled listbox, native <select> can't host rich clickable rows */}
				<div role="listbox" aria-label="Candidates" tabIndex={0}>
					{span.candidates.map((candidate, idx) => (
						<button
							key={candidate.id}
							type="button"
							// biome-ignore lint/a11y/useSemanticElements: custom-styled option row, native <option> can't have onClick/style
							role="option"
							data-testid="candidate-row"
							aria-selected={idx === selectedIdx}
							style={{
								...candidateRowStyle,
								backgroundColor:
									idx === selectedIdx ? preselectedBg : "transparent",
								color: idx === selectedIdx ? entColor : "var(--text-primary)",
							}}
							onClick={() => {
								setSelectedIdx(idx);
								onSelectCandidate(candidate);
							}}
						>
							{candidate.name}
						</button>
					))}
				</div>
			</div>
			<div style={footerStyle}>
				<button
					type="button"
					aria-label={`Create new ${typeLabel}`}
					style={footerBtnStyle}
					onClick={onCreateNew}
				>
					+ Create new {typeLabel}
				</button>
				<button
					type="button"
					aria-label="Skip"
					style={footerBtnStyle}
					onClick={onSkip}
				>
					Skip
				</button>
			</div>
		</div>
	);
}
