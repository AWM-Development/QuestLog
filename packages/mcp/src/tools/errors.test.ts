import { AmbiguousEntityError } from "@questlog/core/lib/errors.js";
import { describe, expect, it } from "vitest";
import { withToolErrors } from "./errors.js";

describe("withToolErrors", () => {
	it("maps AmbiguousEntityError to an AMBIGUOUS_ENTITY result carrying its candidates", async () => {
		const candidates = [
			{ id: "a", name: "Hall", type: "location", parentEntityId: "p1" },
			{ id: "b", name: "Hall", type: "location", parentEntityId: null },
		];
		const result = await withToolErrors(async () => {
			throw new AmbiguousEntityError(candidates);
		})();

		expect(result.isError).toBe(true);
		const first = result.content[0];
		const body = JSON.parse(first?.type === "text" ? first.text : "{}");
		expect(body.error.code).toBe("AMBIGUOUS_ENTITY");
		expect(body.error.candidates).toEqual(candidates);
	});
});
