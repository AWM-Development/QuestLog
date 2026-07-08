import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { setup } from "./global-setup.js";

const connectionString =
	process.env.DATABASE_URL ??
	"postgresql://questlog:questlog@localhost:5433/questlog_test";

describe("global-setup", () => {
	const client = postgres(connectionString, { max: 1 });

	afterAll(async () => {
		await client.end();
	});

	it("cleans up an orphaned write_requests row instead of throwing an FK violation on campaigns", async () => {
		const campaignRows = await client`
			INSERT INTO campaigns (name, theme) VALUES ('Orphan Test Campaign', 'fantasy') RETURNING id
		`;
		const campaignId = (campaignRows[0] as { id: string }).id;
		await client`
			INSERT INTO write_requests (campaign_id, tool_name, payload, expires_at)
			VALUES (${campaignId}, 'log_session', '{}'::jsonb, now() + interval '15 minutes')
		`;

		await expect(setup()).resolves.not.toThrow();

		const campaignCountRows = await client`
			SELECT count(*)::int AS count FROM campaigns WHERE id = ${campaignId}
		`;
		const writeRequestCountRows = await client`
			SELECT count(*)::int AS count FROM write_requests WHERE campaign_id = ${campaignId}
		`;
		expect((campaignCountRows[0] as { count: number }).count).toBe(0);
		expect((writeRequestCountRows[0] as { count: number }).count).toBe(0);
	});
});
