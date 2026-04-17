import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../../test-utils.js";

const mockNavigate = vi.fn();

vi.mock("react-router", async () => {
	const actual = await vi.importActual("react-router");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

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
import { CampaignCreateModal } from "./CampaignCreateModal.js";

const mockCreateMutation = trpc.campaign.create.useMutation as ReturnType<
	typeof vi.fn
>;

function renderCreateModal(onClose = vi.fn()) {
	return {
		onClose,
		...renderWithRouter(
			[
				{
					path: "/campaigns",
					element: <CampaignCreateModal onClose={onClose} />,
				},
			],
			{ initialEntries: ["/campaigns"] },
		),
	};
}

describe("CampaignCreateModal", () => {
	it("renders the form fields", () => {
		mockCreateMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
			isError: false,
			error: null,
		});

		renderCreateModal();

		expect(screen.getByLabelText("Name *")).toBeInTheDocument();
		expect(screen.getByLabelText("Description")).toBeInTheDocument();
		expect(screen.getByLabelText("Theme")).toBeInTheDocument();
		expect(screen.getByLabelText("Game System")).toBeInTheDocument();
	});

	it("disables submit when name is empty", () => {
		mockCreateMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
			isError: false,
			error: null,
		});

		renderCreateModal();

		const submitBtn = screen.getByRole("button", { name: "Create Campaign" });
		expect(submitBtn).toBeDisabled();
	});

	it("enables submit when name is filled in", async () => {
		mockCreateMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
			isError: false,
			error: null,
		});

		renderCreateModal();
		const user = userEvent.setup();

		await user.type(screen.getByLabelText("Name *"), "My Campaign");

		expect(
			screen.getByRole("button", { name: "Create Campaign" }),
		).not.toBeDisabled();
	});

	it("calls onClose when Cancel is clicked", async () => {
		mockCreateMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
			isError: false,
			error: null,
		});

		const { onClose } = renderCreateModal();
		const user = userEvent.setup();

		await user.click(screen.getByText("Cancel"));

		expect(onClose).toHaveBeenCalledOnce();
	});

	it("calls mutate with form data on submit", async () => {
		const mutate = vi.fn();
		mockCreateMutation.mockReturnValue({
			mutate,
			isPending: false,
			isError: false,
			error: null,
		});

		renderCreateModal();
		const user = userEvent.setup();

		await user.type(screen.getByLabelText("Name *"), "Test Campaign");
		await user.click(screen.getByRole("button", { name: "Create Campaign" }));

		expect(mutate).toHaveBeenCalledWith({
			name: "Test Campaign",
			description: undefined,
			theme: "fantasy",
			gameSystem: undefined,
		});
	});

	it("shows error message on mutation failure", () => {
		mockCreateMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
			isError: true,
			error: { message: "Name is required" },
		});

		renderCreateModal();

		expect(screen.getByRole("alert")).toBeInTheDocument();
	});

	it("renders all theme options", () => {
		mockCreateMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: false,
			isError: false,
			error: null,
		});

		renderCreateModal();

		const themeSelect = screen.getByLabelText("Theme");
		const options = themeSelect.querySelectorAll("option");
		const values = Array.from(options).map((o) => o.value);
		expect(values).toContain("fantasy");
		expect(values).toContain("sci-fi");
		expect(values).toContain("horror");
		expect(values).toContain("western");
		expect(values).toContain("modern");
	});

	it("shows Creating... text when mutation is pending", () => {
		mockCreateMutation.mockReturnValue({
			mutate: vi.fn(),
			isPending: true,
			isError: false,
			error: null,
		});

		renderCreateModal();

		expect(screen.getByText("Creating...")).toBeInTheDocument();
	});
});
