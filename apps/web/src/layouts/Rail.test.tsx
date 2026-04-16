import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Rail } from "./Rail.js";

const listUseQuery = vi.fn();

vi.mock("../lib/trpc.js", () => ({
	trpc: {
		session: {
			list: {
				useQuery: (...args: unknown[]) => listUseQuery(...args),
			},
		},
	},
}));

function renderRail(campaignId: string | undefined) {
	return render(
		<MemoryRouter>
			<Rail campaignId={campaignId} />
		</MemoryRouter>,
	);
}

describe("Rail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		listUseQuery.mockReturnValue({ data: [] });
	});

	it("subscribes to session.list with staleTime when a campaign is active", () => {
		renderRail("camp-1");
		expect(listUseQuery).toHaveBeenCalledWith(
			{ campaignId: "camp-1" },
			expect.objectContaining({ enabled: true, staleTime: 60_000 }),
		);
	});

	it("disables session.list when there is no campaign", () => {
		renderRail(undefined);
		expect(listUseQuery).toHaveBeenCalledWith(
			{ campaignId: "" },
			expect.objectContaining({ enabled: false }),
		);
	});

	it("does not show a draft dot when there is no draft session", () => {
		listUseQuery.mockReturnValue({
			data: [{ status: "finalized" }, { status: "finalized" }],
		});
		renderRail("camp-1");
		expect(
			screen.queryByLabelText("Draft session in progress"),
		).not.toBeInTheDocument();
	});

	it("shows a draft dot on Session logs when any session is draft", () => {
		listUseQuery.mockReturnValue({
			data: [{ status: "finalized" }, { status: "draft" }],
		});
		renderRail("camp-1");
		expect(
			screen.getByLabelText("Draft session in progress"),
		).toBeInTheDocument();
	});

	it("does not show a draft dot while list data is still loading", () => {
		listUseQuery.mockReturnValue({ data: undefined });
		renderRail("camp-1");
		expect(
			screen.queryByLabelText("Draft session in progress"),
		).not.toBeInTheDocument();
	});
});
