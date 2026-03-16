import { trpc } from "@/lib/trpc.js";
import type { Source } from "../types.js";

/**
 * Polls trpc.source.list for a campaign.
 * Polls every 2 s while any source is in-flight (not yet done or error);
 * stops once all sources have settled.
 *
 * "active" includes error-status sources so they remain visible in the
 * ImportQueue with the ErrorState inline prompt until the user dismisses.
 *
 * This is the single place that calls source.list.useQuery — components
 * use this hook rather than calling trpc directly.
 */
export function useSourcePolling(campaignId: string) {
	const query = trpc.source.list.useQuery(
		{ campaignId },
		{
			// Poll only while sources are genuinely in-flight (not settled).
			refetchInterval: (query) => {
				const data = query.state.data as Source[] | undefined;
				if (!data) return false;
				const hasInFlight = data.some(
					(s) => s.status !== "done" && s.status !== "error",
				);
				return hasInFlight ? 2000 : false;
			},
		},
	);

	// The DB schema exposes `status` as `string`; we narrow it to `SourceStatus`
	// here at the boundary. This cast is safe because the server only ever writes
	// values from the SOURCE_STATUSES constant set.
	const sources: Source[] = (query.data as Source[] | undefined) ?? [];
	// Active = anything not yet settled. Includes "error" so failed sources
	// remain visible in the ImportQueue with the ErrorState inline prompt.
	const activeSources = sources.filter((s) => s.status !== "done");
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
