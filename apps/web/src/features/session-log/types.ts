export type EntityType = "npc" | "faction" | "location" | "item" | "arc";

export interface EntitySpan {
	entityId: string;
	entityName: string;
	entityType: EntityType;
	startIndex: number;
	endIndex: number;
	matchType: "confirmed" | "ambiguous" | "unlinked";
	candidates: { id: string; name: string }[];
}
