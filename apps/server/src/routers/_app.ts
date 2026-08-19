import { router } from "../trpc.js";
import { campaignRouter } from "./campaign.js";
import { commentRouter } from "./comment.js";
import { conversationRouter } from "./conversation.js";
import { entityRouter } from "./entity.js";
import { importRouter } from "./import.js";
import { observabilityRouter } from "./observability.js";
import { searchRouter } from "./search.js";
import { sessionRouter } from "./session.js";
import { sourceRouter } from "./source.js";

export const appRouter = router({
	campaign: campaignRouter,
	comment: commentRouter,
	conversation: conversationRouter,
	entity: entityRouter,
	import: importRouter,
	observability: observabilityRouter,
	search: searchRouter,
	session: sessionRouter,
	source: sourceRouter,
});

export type AppRouter = typeof appRouter;
