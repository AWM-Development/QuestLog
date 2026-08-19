import { testDbUrl } from "@questlog/core/db/test-db-url.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addComment, listComments } from "./comment.js";
import { truncateAllTables } from "./db/global-setup.js";
import { ticketComments, ticketReports, ticketRuns } from "./schema/tables.js";

// testDbUrl(), not process.env.DATABASE_URL directly — same reasoning as
// ingest-db.test.ts (Docs/IMPLEMENTATION_NOTES.md § T-052).
const client: Sql = postgres(testDbUrl("questlog_test_observability"), {
	max: 1,
});
// Full schema, not just ticketComments — Database is typed from the
// package's complete schema, see ingest-db.test.ts's identical note.
const db = drizzle(client, {
	schema: { ticketComments, ticketRuns, ticketReports },
});

beforeEach(async () => {
	await truncateAllTables(client);
});

afterAll(async () => {
	await client.end();
});

describe("addComment / listComments", () => {
	it("add followed by list returns the new comment with author 'alex', correct body, and a server-set createdAt", async () => {
		const before = new Date();

		const inserted = await addComment(db, "T-999", "Nice work on this one.");

		expect(inserted.ticketId).toBe("T-999");
		expect(inserted.author).toBe("alex");
		expect(inserted.body).toBe("Nice work on this one.");
		expect(inserted.createdAt.getTime()).toBeGreaterThanOrEqual(
			before.getTime(),
		);

		const comments = await listComments(db, "T-999");
		expect(comments).toHaveLength(1);
		expect(comments[0]).toMatchObject({
			ticketId: "T-999",
			author: "alex",
			body: "Nice work on this one.",
		});
	});

	it("ignores any client-supplied createdAt/author — both are always server-set", async () => {
		const inserted = await addComment(db, "T-998", "second comment");
		expect(inserted.author).toBe("alex");
	});

	it("returns comments oldest first", async () => {
		await addComment(db, "T-997", "first");
		await addComment(db, "T-997", "second");
		await addComment(db, "T-997", "third");

		const comments = await listComments(db, "T-997");
		expect(comments.map((c) => c.body)).toEqual(["first", "second", "third"]);
	});

	it("returns an empty array, not an error, for a ticketId with no comments", async () => {
		const comments = await listComments(db, "T-000-no-comments");
		expect(comments).toEqual([]);
	});
});
