import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../../test-utils.js";

vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		source: {
			importText: { useMutation: vi.fn() },
			list: { useQuery: vi.fn() },
		},
		useUtils: vi.fn(() => ({
			source: { list: { invalidate: vi.fn() } },
		})),
	};
	return { trpc: mockTrpc, createTRPCClient: vi.fn(() => ({})) };
});

import { trpc } from "@/lib/trpc.js";
import { PasteTextInput } from "./PasteTextInput.js";

const mockMutation = trpc.source.importText.useMutation as ReturnType<
	typeof vi.fn
>;

const CAMPAIGN_ID = "00000000-0000-0000-0000-000000000001";

function renderPaste(
	props: Partial<React.ComponentProps<typeof PasteTextInput>> = {},
) {
	const mutateFn = vi.fn();
	mockMutation.mockReturnValue({
		mutate: mutateFn,
		isPending: false,
		isError: false,
		error: null,
		isSuccess: false,
		reset: vi.fn(),
	});

	const result = renderWithRouter(
		[
			{
				path: "/",
				element: <PasteTextInput campaignId={CAMPAIGN_ID} {...props} />,
			},
		],
		{ initialEntries: ["/"] },
	);
	return { ...result, mutateFn };
}

describe("PasteTextInput", () => {
	it("starts collapsed — only toggle link visible", () => {
		renderPaste();
		expect(screen.getByText(/paste text directly/i)).toBeInTheDocument();
		expect(
			screen.queryByRole("textbox", { name: /source title/i }),
		).not.toBeInTheDocument();
	});

	it("expands when toggle link is clicked", async () => {
		renderPaste();
		const user = userEvent.setup();

		await user.click(screen.getByText(/paste text directly/i));

		expect(
			screen.getByRole("textbox", { name: /source title/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("textbox", { name: /paste content/i }),
		).toBeInTheDocument();
	});

	it("disables submit button when title is empty", async () => {
		renderPaste();
		const user = userEvent.setup();

		await user.click(screen.getByText(/paste text directly/i));
		await user.type(
			screen.getByRole("textbox", { name: /paste content/i }),
			"Some content",
		);

		const btn = screen.getByRole("button", { name: /import text/i });
		expect(btn).toBeDisabled();
	});

	it("enables submit button when title has content", async () => {
		renderPaste();
		const user = userEvent.setup();

		await user.click(screen.getByText(/paste text directly/i));
		await user.type(
			screen.getByRole("textbox", { name: /source title/i }),
			"My notes",
		);
		await user.type(
			screen.getByRole("textbox", { name: /paste content/i }),
			"Content here",
		);

		const btn = screen.getByRole("button", { name: /import text/i });
		expect(btn).toBeEnabled();
	});

	it("calls mutation on submit with title and content", async () => {
		const { mutateFn } = renderPaste();
		const user = userEvent.setup();

		await user.click(screen.getByText(/paste text directly/i));
		await user.type(
			screen.getByRole("textbox", { name: /source title/i }),
			"NPC backstories",
		);
		await user.type(
			screen.getByRole("textbox", { name: /paste content/i }),
			"Aldric is grizzled",
		);
		await user.click(screen.getByRole("button", { name: /import text/i }));

		expect(mutateFn).toHaveBeenCalledWith({
			campaignId: CAMPAIGN_ID,
			title: "NPC backstories",
			content: "Aldric is grizzled",
		});
	});

	it("collapses when toggle is clicked again", async () => {
		renderPaste();
		const user = userEvent.setup();

		await user.click(screen.getByText(/paste text directly/i));
		expect(
			screen.getByRole("textbox", { name: /source title/i }),
		).toBeInTheDocument();

		await user.click(screen.getByText(/collapse/i));
		expect(
			screen.queryByRole("textbox", { name: /source title/i }),
		).not.toBeInTheDocument();
	});
});
