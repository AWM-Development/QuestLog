import { router } from "../trpc.js";
import { campaignRouter } from "./campaign.js";
import { importRouter } from "./import.js";

export const appRouter = router({
	campaign: campaignRouter,
	import: importRouter,
});

export type AppRouter = typeof appRouter;
