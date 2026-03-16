import { trpc } from "@/lib/trpc.js";
import type { Source } from "../types.js";

/**
 * Polls trpc.source.list for a campaign.
 * Automatically polls every 2 s when active imports exist (status not done/error);
 * stops polling when all sources are settled.
 *
 * This is the single place that calls source.list.useQuery — components
 * use this hook rather than calling trpc directly.
 */
export function useSourcePolling(campaignId: string) {
	const query = trpc.source.list.useQuery(
		{ campaignId },
		{
			// Dynamic refetch interval: poll while there are in-flight sources
			refetchInterval: (query) => {
				const data = query.state.data as Source[] | undefined;
				if (!data) return false;
				const hasActive = data.some(
					(s) => s.status !== "done" && s.status !== "error",
				);
				return hasActive ? 2000 : false;
			},
		},
	);

	const sources: Source[] = (query.data as Source[] | undefined) ?? [];
	const activeSources = sources.filter(
		(s) => s.status !== "done" && s.status !== "error",
	);
	const completedSources = sources.filter((s) => s.status === "done");

	return {
		sources,
		activeSources,
		completedSources,
		isLoading: query.isLoading,
		isError: query.isError,
		refetch: query.refetch,
	};
}
