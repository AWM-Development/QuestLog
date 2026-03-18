import { router } from "../trpc.js";
import { campaignRouter } from "./campaign.js";
import { conversationRouter } from "./conversation.js";
import { importRouter } from "./import.js";
import { searchRouter } from "./search.js";
import { sourceRouter } from "./source.js";

export const appRouter = router({
	campaign: campaignRouter,
	conversation: conversationRouter,
	import: importRouter,
	search: searchRouter,
	source: sourceRouter,
});

export type AppRouter = typeof appRouter;
