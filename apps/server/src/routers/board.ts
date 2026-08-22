import { boardService } from "@questlog/core/services/board.service.js";
import { procedure, router, withErrorHandling } from "../trpc.js";

/**
 * Read-only router over `Docs/tickets/`'s live pipeline state, backed by a
 * server-side GitHub API read against `develop` with a short in-memory
 * cache (`boardService`'s own ~60s TTL — see `board.service.ts`). Not
 * surfaced in any UI yet (T-158 is the consumer, still gated on G-043's
 * visual design).
 */
export const boardRouter = router({
	/** Every parseable ticket card across the six pipeline folders. */
	list: procedure.query(() => withErrorHandling(() => boardService.list())),
});
