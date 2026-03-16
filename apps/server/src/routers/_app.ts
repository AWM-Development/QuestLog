import { router } from "../trpc.js";
import { campaignRouter } from "./campaign.js";
import { importRouter } from "./import.js";
import { sourceRouter } from "./source.js";

export const appRouter = router({
	campaign: campaignRouter,
	import: importRouter,
	source: sourceRouter,
});

export type AppRouter = typeof appRouter;
