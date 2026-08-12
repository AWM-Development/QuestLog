import { asc, eq } from "drizzle-orm";
import type { Database } from "./db/index.js";
import { ticketComments } from "./schema/tables.js";

export interface CommentRow {
	id: string;
	ticketId: string;
	author: string;
	body: string;
	createdAt: Date;
}

/** Comments for a given ticket, oldest first. Empty array (not an error) when none exist. */
export async function listComments(
	db: Database,
	ticketId: string,
): Promise<CommentRow[]> {
	return db
		.select()
		.from(ticketComments)
		.where(eq(ticketComments.ticketId, ticketId))
		.orderBy(asc(ticketComments.createdAt));
}

/**
 * Inserts a new comment. `author` is always `"alex"`, hardcoded here rather
 * than accepted as an input — v1 has no auth/identity system to derive a
 * second caller from (agent-authored comments are deferred, see T-059's
 * ticket). `createdAt` is always server-set via the column default.
 */
export async function addComment(
	db: Database,
	ticketId: string,
	body: string,
): Promise<CommentRow> {
	const [row] = await db
		.insert(ticketComments)
		.values({ ticketId, author: "alex", body })
		.returning();
	if (!row) {
		throw new Error("Insert into ticket_comments returned no row");
	}
	return row;
}
