import { router } from "../trpc.js";
import { campaignRouter } from "./campaign.js";

export const appRouter = router({
	campaign: campaignRouter,
});

export type AppRouter = typeof appRouter;
