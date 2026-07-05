import { type CSSProperties, useState } from "react";
import type { EntitySpan, EntityType } from "../../types.js";
import { EntityHoverCard } from "./EntityHoverCard.js";

const ENTITY_TYPES: EntityType[] = [
	"npc",
	"faction",
	"location",
	"item",
	"arc",
];

const TYPE_LABELS: Record<EntityType, string> = {
	npc: "NPC",
	faction: "Faction",
	location: "Location",
	item: "Item",
	arc: "Arc",
};

interface DetectedEntitiesPanelProps {
	detectedSpans: EntitySpan[];
	onScrollToSpan: (span: EntitySpan) => void;
	onActivateActionBar: (span: EntitySpan) => void;
	hoveredSpan?: EntitySpan | null;
	onSelectCandidate?: (candidate: { id: string; name: string }) => void;
	onCreateNew?: () => void;
	onSkipHover?: () => void;
	campaignEntityCount?: number;
}

const panelStyle: CSSProperties = {
	background: "var(--bg-surface)",
	border: "1px solid var(--border)",
	borderRadius: "var(--r-md)",
	overflow: "hidden",
	marginTop: "var(--space-2)",
};

const headerStyle: CSSProperties = {
	padding: "var(--space-2-5) var(--space-3)",
	borderBottom: "1px solid var(--border)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
};

const emptyStateStyle: CSSProperties = {
	padding: "var(--space-4) var(--space-3)",
	fontSize: "0.6875rem",
	color: "var(--text-dim)",
	lineHeight: 1.7,
};

const countBadgeStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	padding: "1px 6px",
	borderRadius: "var(--r-pill)",
	border: "0.5px solid var(--border)",
	backgroundColor: "var(--bg-elevated)",
	fontSize: "0.5625rem",
	color: "var(--text-muted)",
	marginLeft: "var(--space-1-5)",
	fontFamily: "var(--font-mono)",
};

const entityCountFooterStyle: CSSProperties = {
	padding: "var(--space-2) var(--space-3)",
	borderTop: "1px solid var(--border-subtle)",
	fontFamily: "var(--font-mono)",
	fontSize: "0.5625rem",
	color: "var(--text-dim)",
	letterSpacing: "0.04em",
};

function groupByType(spans: EntitySpan[]): Map<EntityType, EntitySpan[]> {
	const map = new Map<EntityType, EntitySpan[]>();
	for (const span of spans) {
		const type = span.entityType as EntityType;
		const existing = map.get(type) ?? [];
		existing.push(span);
		map.set(type, existing);
	}
	return map;
}

export function DetectedEntitiesPanel({
	detectedSpans,
	onScrollToSpan,
	onActivateActionBar,
	hoveredSpan,
	onSelectCandidate,
	onCreateNew,
	onSkipHover,
	campaignEntityCount,
}: DetectedEntitiesPanelProps) {
	const [collapsed, setCollapsed] = useState<Set<EntityType>>(new Set());
	const groupedSpans = groupByType(detectedSpans);

	const totalCount = detectedSpans.length;
	const isHoveringMode =
		hoveredSpan != null && hoveredSpan.matchType === "ambiguous";

	const toggleGroup = (type: EntityType) => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(type)) {
				next.delete(type);
			} else {
				next.add(type);
			}
			return next;
		});
	};

	return (
		<div data-testid="detected-entities-panel" style={panelStyle}>
			<div style={headerStyle}>
				<span
					style={{
						fontSize: "0.6875rem",
						color: "var(--text-secondary)",
						fontWeight: 500,
						display: "flex",
						alignItems: "center",
					}}
				>
					{isHoveringMode
						? `Hovering · ${hoveredSpan.entityType.toUpperCase()}`
						: "Detected Entities"}
					{!isHoveringMode && totalCount > 0 && (
						<span data-testid="count-badge" style={countBadgeStyle}>
							{totalCount}
						</span>
					)}
				</span>
				<span style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
					{isHoveringMode ? (
						<span
							style={{ color: "var(--status-warning)", fontSize: "0.5rem" }}
						>
							AMBIGUOUS
						</span>
					) : null}
				</span>
			</div>

			{isHoveringMode ? (
				<div style={{ padding: "var(--space-2)" }}>
					<EntityHoverCard
						span={hoveredSpan}
						onSelectCandidate={(candidate) => onSelectCandidate?.(candidate)}
						onCreateNew={() => onCreateNew?.()}
						onSkip={() => onSkipHover?.()}
					/>
				</div>
			) : detectedSpans.length === 0 ? (
				<div data-testid="dock-empty-state" style={emptyStateStyle}>
					<p style={{ marginBottom: "var(--space-2)" }}>
						Start writing and QuestLog will surface{" "}
						<span style={{ color: "var(--ent-npc)" }}>NPCs</span>,{" "}
						<span style={{ color: "var(--ent-location)" }}>locations</span>,{" "}
						<span style={{ color: "var(--ent-faction)" }}>factions</span>, and{" "}
						<span style={{ color: "var(--ent-item)" }}>items</span> from your
						campaign.
					</p>
					{campaignEntityCount !== undefined && (
						<p data-testid="dock-entity-count" style={entityCountFooterStyle}>
							{campaignEntityCount} entities indexed in this campaign
						</p>
					)}
				</div>
			) : (
				ENTITY_TYPES.filter(
					(type) => (groupedSpans.get(type)?.length ?? 0) > 0,
				).map((type) => {
					const spans = groupedSpans.get(type) ?? [];
					const isCollapsed = collapsed.has(type);
					return (
						<TypeGroup
							key={type}
							type={type}
							spans={spans}
							isCollapsed={isCollapsed}
							onToggle={() => toggleGroup(type)}
							onScrollToSpan={onScrollToSpan}
							onActivateActionBar={onActivateActionBar}
						/>
					);
				})
			)}
		</div>
	);
}

interface TypeGroupProps {
	type: EntityType;
	spans: EntitySpan[];
	isCollapsed: boolean;
	onToggle: () => void;
	onScrollToSpan: (span: EntitySpan) => void;
	onActivateActionBar: (span: EntitySpan) => void;
}

function TypeGroup({
	type,
	spans,
	isCollapsed,
	onToggle,
	onScrollToSpan,
	onActivateActionBar,
}: TypeGroupProps) {
	const groupHeaderStyle: CSSProperties = {
		padding: "var(--space-1-5) var(--space-3)",
		display: "flex",
		alignItems: "center",
		gap: "var(--space-1-5)",
		cursor: "pointer",
		background: "var(--bg-elevated)",
		borderBottom: "1px solid var(--border-subtle)",
	};

	return (
		<div>
			<button
				type="button"
				style={{
					...groupHeaderStyle,
					width: "100%",
					border: "none",
					textAlign: "left",
				}}
				onClick={onToggle}
			>
				<span style={{ fontSize: "0.625rem", color: `var(--ent-${type})` }}>
					{isCollapsed ? "▸" : "▾"}
				</span>
				<span
					style={{
						fontSize: "0.625rem",
						color: `var(--ent-${type})`,
						fontWeight: 500,
						letterSpacing: "0.06em",
						textTransform: "uppercase",
					}}
				>
					{TYPE_LABELS[type]}
				</span>
				<span
					style={{
						fontSize: "0.625rem",
						color: "var(--text-muted)",
						marginLeft: "auto",
					}}
				>
					{spans.length}
				</span>
			</button>
			{!isCollapsed && (
				<div style={{ padding: "2px var(--space-3) var(--space-1-5) 24px" }}>
					{spans.map((span) => (
						<EntityRow
							key={`${span.matchType}-${span.startIndex}`}
							span={span}
							entityType={type}
							onScrollToSpan={onScrollToSpan}
							onActivateActionBar={onActivateActionBar}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface EntityRowProps {
	span: EntitySpan;
	entityType: EntityType;
	onScrollToSpan: (span: EntitySpan) => void;
	onActivateActionBar: (span: EntitySpan) => void;
}

function EntityRow({
	span,
	entityType,
	onScrollToSpan,
	onActivateActionBar,
}: EntityRowProps) {
	const isConfirmed = span.matchType === "confirmed";

	const dotColor = isConfirmed
		? `var(--ent-${entityType})`
		: span.matchType === "ambiguous"
			? "var(--status-warning)"
			: "var(--text-muted)";

	const handleClick = () => {
		if (isConfirmed) {
			onScrollToSpan(span);
		} else {
			onActivateActionBar(span);
		}
	};

	return (
		<button
			type="button"
			style={{
				display: "flex",
				alignItems: "center",
				gap: "var(--space-1-5)",
				padding: "var(--space-1) var(--space-1-5)",
				borderRadius: "var(--r-sm)",
				marginBottom: "var(--space-0-5)",
				cursor: "pointer",
				width: "100%",
				border: "none",
				background: "transparent",
				textAlign: "left",
			}}
			onClick={handleClick}
		>
			<span
				data-status-dot={span.matchType}
				style={{
					width: 5,
					height: 5,
					borderRadius: "50%",
					background: dotColor,
					flexShrink: 0,
					display: "inline-block",
				}}
			/>
			<span
				style={{
					fontSize: "0.75rem",
					color: isConfirmed ? "var(--text-primary)" : "var(--text-secondary)",
					flex: 1,
				}}
			>
				{span.entityName}
			</span>
			{span.matchType === "ambiguous" && (
				<span style={{ fontSize: "0.5625rem", color: "var(--status-warning)" }}>
					{span.candidates.length} matches
				</span>
			)}
			{span.matchType === "unlinked" && (
				<span style={{ fontSize: "0.5625rem", color: "var(--text-muted)" }}>
					new?
				</span>
			)}
		</button>
	);
}
