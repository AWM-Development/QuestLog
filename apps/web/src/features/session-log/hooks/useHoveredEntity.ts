import { useState } from "react";
import type { EntitySpan } from "../types.js";

export interface UseHoveredEntityReturn {
	hoveredSpan: EntitySpan | null;
	setHoveredSpan: (span: EntitySpan | null) => void;
}

export function useHoveredEntity(): UseHoveredEntityReturn {
	const [hoveredSpan, setHoveredSpan] = useState<EntitySpan | null>(null);
	return { hoveredSpan, setHoveredSpan };
}
