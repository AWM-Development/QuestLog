import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../test-utils.js";

// Mock the trpc module
vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		campaign: {
			list: { useQuery: vi.fn() },
			create: { useMutation: vi.fn() },
		},
		useUtils: vi.fn(() => ({
			campaign: { list: { invalidate: vi.fn() } },
		})),
	};
	return {
		trpc: mockTrpc,
		createTRPCClient: vi.fn(() => ({})),
	};
});

import { trpc } from "@/lib/trpc.js";
import { CampaignListPage } from "./CampaignListPage.js";

const mockList = trpc.campaign.list.useQuery as ReturnType<typeof vi.fn>;
const mockCreateMutation = trpc.campaign.create.useMutation as ReturnType<
	typeof vi.fn
>;

function renderCampaignList() {
	mockCreateMutation.mockReturnValue({
		mutate: vi.fn(),
		isPending: false,
		isError: false,
		error: null,
	});

	return renderWithRouter(
		[
			{ path: "/campaigns", element: <CampaignListPage /> },
			{ path: "/campaign/:id", element: <p>Campaign detail</p> },
		],
		{ initialEntries: ["/campaigns"] },
	);
}

describe("CampaignListPage", () => {
	it("shows loading skeleton initially", () => {
		mockList.mockReturnValue({
			isLoading: true,
			isError: false,
			isSuccess: false,
			data: undefined,
		});

		renderCampaignList();
		expect(screen.getByLabelText("Loading campaigns")).toBeInTheDocument();
	});

	it("shows empty state when no campaigns exist", () => {
		mockList.mockReturnValue({
			isLoading: false,
			isError: false,
			isSuccess: true,
			data: [],
		});

		renderCampaignList();
		expect(screen.getByText("No campaigns yet")).toBeInTheDocument();
		expect(screen.getByText("Create Campaign")).toBeInTheDocument();
	});

	it("renders campaign cards when data is loaded", () => {
		mockList.mockReturnValue({
			isLoading: false,
			isError: false,
			isSuccess: true,
			data: [
				{
					id: "1",
					name: "Curse of Strahd",
					description: "A dark gothic horror campaign",
					theme: "horror",
					gameSystem: "D&D 5e",
					status: "active",
				},
				{
					id: "2",
					name: "Starfinder",
					description: null,
					theme: "sci-fi",
					gameSystem: "Starfinder",
					status: "active",
				},
			],
		});

		renderCampaignList();

		expect(
			screen.getByRole("heading", { name: "Curse of Strahd" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Starfinder" }),
		).toBeInTheDocument();
		expect(screen.getByText("D&D 5e")).toBeInTheDocument();
		expect(screen.getByText("horror")).toBeInTheDocument();
		expect(screen.getByText("sci-fi")).toBeInTheDocument();
	});

	it("shows error state on fetch failure", () => {
		mockList.mockReturnValue({
			isLoading: false,
			isError: true,
			isSuccess: false,
			error: { message: "Something went wrong" },
		});

		renderCampaignList();

		expect(screen.getByRole("alert")).toBeInTheDocument();
		expect(screen.getByText("Failed to load campaigns")).toBeInTheDocument();
	});

	it("opens the create modal when New Campaign is clicked", async () => {
		mockList.mockReturnValue({
			isLoading: false,
			isError: false,
			isSuccess: true,
			data: [],
		});

		renderCampaignList();
		const user = userEvent.setup();

		await user.click(screen.getByText("New Campaign"));

		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});
});
