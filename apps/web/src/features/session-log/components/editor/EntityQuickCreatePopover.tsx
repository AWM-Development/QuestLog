import { type CSSProperties, useState } from "react";
import { trpc } from "../../../../lib/trpc.js";
import type { EntityType } from "../../types.js";

const ENTITY_TYPES: { type: EntityType; label: string; abbr: string }[] = [
	{ type: "npc", label: "NPC", abbr: "N" },
	{ type: "faction", label: "Faction", abbr: "F" },
	{ type: "location", label: "Location", abbr: "L" },
	{ type: "item", label: "Item", abbr: "I" },
	{ type: "arc", label: "Arc", abbr: "A" },
];

const TYPE_VARS: Record<EntityType, string> = {
	npc: "--ent-npc",
	faction: "--ent-faction",
	location: "--ent-location",
	item: "--ent-item",
	arc: "--ent-arc",
};

const TYPE_RGB_VARS: Record<EntityType, string> = {
	npc: "--ent-npc-rgb",
	faction: "--ent-faction-rgb",
	location: "--ent-location-rgb",
	item: "--ent-item-rgb",
	arc: "--ent-arc-rgb",
};

interface EntityQuickCreatePopoverProps {
	spanText: string;
	initialType: EntityType;
	campaignId: string;
	position: { top: number; left: number };
	onCreated: (entity: { id: string; name: string; type: string }) => void;
	onClose: () => void;
}

export function EntityQuickCreatePopover({
	spanText,
	initialType,
	campaignId,
	position,
	onCreated,
	onClose,
}: EntityQuickCreatePopoverProps) {
	const [selectedType, setSelectedType] = useState<EntityType>(initialType);
	const [name, setName] = useState(spanText);
	const [description, setDescription] = useState("");

	const createMutation = trpc.entity.create.useMutation();

	const colorVar = `var(${TYPE_VARS[selectedType]})`;
	const rgbVar = `var(${TYPE_RGB_VARS[selectedType]})`;

	const handleCreate = async () => {
		if (!name.trim()) return;
		const entity = await createMutation.mutateAsync({
			campaignId,
			name: name.trim(),
			type: selectedType,
			description: description.trim() || undefined,
		});
		onCreated(entity);
	};

	const containerStyle: CSSProperties = {
		position: "absolute",
		top: position.top,
		left: position.left,
		width: 220,
		background: "var(--bg-focal)",
		border: "1px solid var(--border-hover)",
		borderRadius: "var(--r-md)",
		overflow: "hidden",
		boxShadow: "var(--shadow-focal)",
		zIndex: 200,
	};

	const headerStyle: CSSProperties = {
		background: `rgba(${rgbVar}, 0.08)`,
		borderBottom: `1px solid rgba(${rgbVar}, 0.15)`,
		padding: "var(--space-2-5) var(--space-3-5)",
		display: "flex",
		alignItems: "center",
		gap: "var(--space-2)",
	};

	const bodyStyle: CSSProperties = {
		padding: "var(--space-3) var(--space-3-5)",
		background: "var(--bg-focal)",
	};

	const nameInputStyle: CSSProperties = {
		background: "var(--bg-surface)",
		border: `1px solid rgba(${rgbVar}, 0.2)`,
		borderRadius: "var(--r-sm)",
		padding: "var(--space-1-5) var(--space-2-5)",
		fontSize: "0.8125rem",
		fontFamily: "var(--font-display)",
		color: "var(--text-primary)",
		width: "100%",
		marginBottom: "var(--space-2)",
		boxSizing: "border-box",
		outline: "none",
	};

	const descInputStyle: CSSProperties = {
		background: "var(--bg-surface)",
		border: "1px solid var(--border)",
		borderRadius: "var(--r-sm)",
		padding: "var(--space-1-5) var(--space-2-5)",
		fontSize: "0.75rem",
		color: "var(--text-muted)",
		width: "100%",
		marginBottom: "var(--space-2-5)",
		boxSizing: "border-box",
		outline: "none",
	};

	const footerStyle: CSSProperties = {
		display: "flex",
		gap: "var(--space-1-5)",
	};

	const createBtnStyle: CSSProperties = {
		flex: 1,
		background: `rgba(${rgbVar}, 0.15)`,
		border: `1px solid rgba(${rgbVar}, 0.3)`,
		borderRadius: "var(--r-sm)",
		padding: "var(--space-1-5) 0",
		fontSize: "0.6875rem",
		color: colorVar,
		fontWeight: 500,
		cursor: "pointer",
	};

	const closeBtnStyle: CSSProperties = {
		background: "var(--bg-surface)",
		border: "1px solid var(--border)",
		borderRadius: "var(--r-sm)",
		padding: "var(--space-1-5) var(--space-2)",
		fontSize: "0.6875rem",
		color: "var(--text-muted)",
		cursor: "pointer",
	};

	const typeLabelStyle: CSSProperties = {
		fontSize: "0.625rem",
		color: colorVar,
		marginLeft: "var(--space-1)",
		fontWeight: 500,
		letterSpacing: "0.06em",
		textTransform: "uppercase",
	};

	return (
		<div style={containerStyle}>
			<div style={headerStyle}>
				{ENTITY_TYPES.map(({ type, label, abbr }) => {
					const isSelected = type === selectedType;
					return (
						<button
							key={type}
							type="button"
							aria-label={label}
							style={{
								width: 20,
								height: 20,
								borderRadius: "var(--r-sm)",
								background: `rgba(var(${TYPE_RGB_VARS[type]}), 0.15)`,
								border: isSelected
									? `2px solid rgba(var(${TYPE_RGB_VARS[type]}), 0.5)`
									: `1px solid rgba(var(${TYPE_RGB_VARS[type]}), 0.2)`,
								cursor: "pointer",
								fontSize: "0.5625rem",
								color: `var(${TYPE_VARS[type]})`,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								padding: 0,
							}}
							onClick={() => setSelectedType(type)}
						>
							{abbr}
						</button>
					);
				})}
				<span style={typeLabelStyle}>
					{ENTITY_TYPES.find((t) => t.type === selectedType)?.label}
				</span>
			</div>
			<div style={bodyStyle}>
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					style={nameInputStyle}
					placeholder="Entity name"
				/>
				<input
					type="text"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					style={descInputStyle}
					placeholder="One-line description…"
				/>
				<div style={footerStyle}>
					<button
						type="button"
						style={createBtnStyle}
						onClick={handleCreate}
						disabled={createMutation.isPending}
					>
						{`Create ${ENTITY_TYPES.find((t) => t.type === selectedType)?.label.toLowerCase()}`}
					</button>
					<button type="button" style={closeBtnStyle} onClick={onClose}>
						✕
					</button>
				</div>
			</div>
		</div>
	);
}
