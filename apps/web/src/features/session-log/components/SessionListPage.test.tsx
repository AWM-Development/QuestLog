import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../test-utils.js";

// Mock trpc before any imports that reference it
vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		session: {
			list: { useQuery: vi.fn() },
			create: { useMutation: vi.fn() },
		},
		useUtils: vi.fn(() => ({
			session: {
				getById: { invalidate: vi.fn() },
				list: { invalidate: vi.fn() },
			},
		})),
	};
	return {
		trpc: mockTrpc,
		createTRPCClient: vi.fn(() => ({})),
	};
});

vi.mock("@/layouts/CampaignChromeContext.js", () => ({
	useCampaignChrome: vi.fn(() => ({
		setActiveSessionId: vi.fn(),
		openNotes: vi.fn(),
		isDocked: false,
		dockSession: vi.fn(),
		undock: vi.fn(),
	})),
}));

import { trpc } from "@/lib/trpc.js";
import { SessionListPage } from "./SessionListPage.js";

const mockList = trpc.session.list.useQuery as ReturnType<typeof vi.fn>;
const mockCreate = trpc.session.create.useMutation as ReturnType<typeof vi.fn>;

const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const NEW_SESSION_ID = "33333333-3333-3333-3333-333333333333";

function draftSession() {
	return {
		id: SESSION_ID,
		campaignId: CAMPAIGN_ID,
		sessionNumber: 1,
		date: new Date(2026, 2, 15),
		title: "The Feast of St. Andral",
		summary: null,
		content: "",
		tags: [],
		status: "draft" as const,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

describe("SessionListPage", () => {
	it("clicking a session card navigates to /campaign/:id/sessions/:sessionId", async () => {
		mockList.mockReturnValue({
			data: [draftSession()],
			isLoading: false,
			isSuccess: true,
			refetch: vi.fn(),
		});
		mockCreate.mockReturnValue({ mutate: vi.fn(), isPending: false });

		renderWithRouter(
			[
				{
					path: "/campaign/:id/sessions",
					element: <SessionListPage />,
				},
				{
					path: "/campaign/:id/sessions/:sessionId",
					element: <div data-testid="editor-page">SESSION EDITOR PAGE</div>,
				},
			],
			{ initialEntries: [`/campaign/${CAMPAIGN_ID}/sessions`] },
		);

		const card = screen.getByRole("button", { name: /feast of st. andral/i });
		fireEvent.click(card);

		await waitFor(() => {
			expect(screen.getByTestId("editor-page")).toBeTruthy();
		});
	});

	it("after successful create mutation, navigates to /campaign/:id/sessions/:newId", async () => {
		let capturedOnSuccess: ((row: { id: string }) => void) | undefined;

		mockList.mockReturnValue({
			data: [],
			isLoading: false,
			isSuccess: true,
			refetch: vi.fn(),
		});
		mockCreate.mockImplementation(
			({ onSuccess }: { onSuccess?: (row: { id: string }) => void }) => {
				capturedOnSuccess = onSuccess;
				return { mutate: vi.fn(), isPending: false };
			},
		);

		renderWithRouter(
			[
				{
					path: "/campaign/:id/sessions",
					element: <SessionListPage />,
				},
				{
					path: "/campaign/:id/sessions/:sessionId",
					element: <div data-testid="editor-page">SESSION EDITOR PAGE</div>,
				},
			],
			{ initialEntries: [`/campaign/${CAMPAIGN_ID}/sessions`] },
		);

		// Simulate successful create callback
		act(() => {
			capturedOnSuccess?.({ id: NEW_SESSION_ID });
		});

		await waitFor(() => {
			expect(screen.getByTestId("editor-page")).toBeTruthy();
		});
	});
});
