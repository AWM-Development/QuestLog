import { type CSSProperties, useState } from "react";
import type { EntitySpan, EntityType } from "../../types.js";

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
}

const panelStyle: CSSProperties = {
	background: "var(--bg-surface)",
	border: "1px solid var(--border)",
	borderRadius: 8,
	overflow: "hidden",
	marginTop: 8,
};

const headerStyle: CSSProperties = {
	padding: "10px 12px",
	borderBottom: "1px solid var(--border)",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
};

const emptyStateStyle: CSSProperties = {
	padding: "24px 12px",
	textAlign: "center",
	fontSize: 11,
	color: "var(--text-dim)",
	lineHeight: 1.6,
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
}: DetectedEntitiesPanelProps) {
	const [collapsed, setCollapsed] = useState<Set<EntityType>>(new Set());
	const groupedSpans = groupByType(detectedSpans);

	const totalCount = detectedSpans.length;

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
		<div style={panelStyle}>
			<div style={headerStyle}>
				<span
					style={{
						fontSize: 11,
						color: "var(--text-secondary)",
						fontWeight: 500,
					}}
				>
					Detected Entities
				</span>
				<span style={{ fontSize: 10, color: "var(--text-muted)" }}>
					{totalCount > 0 ? `${totalCount} found` : ""}
				</span>
			</div>

			{detectedSpans.length === 0 ? (
				<div style={emptyStateStyle}>
					{`No entities detected yet.\nStart writing to surface them.`}
				</div>
			) : (
				ENTITY_TYPES.filter((type) => (groupedSpans.get(type)?.length ?? 0) > 0).map(
					(type) => {
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
					},
				)
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
		padding: "7px 12px",
		display: "flex",
		alignItems: "center",
		gap: 6,
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
				<span
					style={{ fontSize: 10, color: `var(--ent-${type})` }}
				>
					{isCollapsed ? "▸" : "▾"}
				</span>
				<span
					style={{
						fontSize: 10,
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
						fontSize: 10,
						color: "var(--text-muted)",
						marginLeft: "auto",
					}}
				>
					{spans.length}
				</span>
			</button>
			{!isCollapsed && (
				<div style={{ padding: "2px 12px 6px 24px" }}>
					{spans.map((span) => (
						<EntityRow
							key={`${span.entityId}-${span.startIndex}`}
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

	const dotColor =
		isConfirmed
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
				gap: 6,
				padding: "4px 6px",
				borderRadius: 4,
				marginBottom: 2,
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
					fontSize: 12,
					color: isConfirmed ? "var(--text-primary)" : "var(--text-secondary)",
					flex: 1,
				}}
			>
				{span.entityName}
			</span>
			{span.matchType === "ambiguous" && (
				<span style={{ fontSize: 9, color: "var(--status-warning)" }}>
					{span.candidates.length} matches
				</span>
			)}
			{span.matchType === "unlinked" && (
				<span style={{ fontSize: 9, color: "var(--text-muted)" }}>new?</span>
			)}
		</button>
	);
}
