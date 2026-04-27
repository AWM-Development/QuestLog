import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../../test-utils.js";

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-router")>();
	return { ...actual, useNavigate: () => mockNavigate };
});

// Mock trpc before any imports that reference it
vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		session: {
			getById: { useQuery: vi.fn() },
			list: { useQuery: vi.fn() },
			update: { useMutation: vi.fn() },
			finalize: { useMutation: vi.fn() },
		},
		entity: {
			detectSpans: { useQuery: vi.fn(() => ({ data: [], isLoading: false })) },
			create: {
				useMutation: vi.fn(() => ({
					mutateAsync: vi.fn().mockResolvedValue({}),
					isPending: false,
				})),
			},
		},
		useUtils: vi.fn(() => ({
			session: {
				getById: { invalidate: vi.fn() },
				list: { invalidate: vi.fn() },
			},
			entity: {
				detectSpans: { fetch: vi.fn().mockResolvedValue([]) },
			},
		})),
	};
	return {
		trpc: mockTrpc,
		createTRPCClient: vi.fn(() => ({})),
	};
});

const mockUndock = vi.fn();
let mockActiveSessionId: string | null = null;

vi.mock("@/layouts/CampaignChromeContext.js", () => ({
	useCampaignChrome: vi.fn(() => ({
		activeSessionId: mockActiveSessionId,
		undock: mockUndock,
		isDocked: true,
		dockSession: vi.fn(),
		setActiveSessionId: vi.fn(),
		openNotes: vi.fn(),
	})),
}));

import { trpc } from "@/lib/trpc.js";
import { DockedSessionPanel } from "./DockedSessionPanel.js";

const mockGetById = trpc.session.getById.useQuery as ReturnType<typeof vi.fn>;
const mockUpdate = trpc.session.update.useMutation as ReturnType<typeof vi.fn>;
const mockFinalize = trpc.session.finalize.useMutation as ReturnType<
	typeof vi.fn
>;

const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";

function draftSession() {
	return {
		id: SESSION_ID,
		campaignId: CAMPAIGN_ID,
		sessionNumber: 3,
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

function setupMutationMocks() {
	mockUpdate.mockReturnValue({
		mutate: vi.fn(),
		mutateAsync: vi.fn().mockResolvedValue(undefined),
		isPending: false,
	});
	mockFinalize.mockReturnValue({
		mutate: vi.fn(),
		isPending: false,
	});
}

function renderPanel(campaignId = CAMPAIGN_ID) {
	return renderWithRouter(
		[
			{
				path: "/campaign/:id",
				element: <DockedSessionPanel campaignId={campaignId} />,
			},
		],
		{ initialEntries: [`/campaign/${campaignId}`] },
	);
}

describe("DockedSessionPanel", () => {
	it("entities panel is present in the dock when session is loaded", () => {
		mockActiveSessionId = SESSION_ID;
		setupMutationMocks();
		mockGetById.mockReturnValue({
			data: draftSession(),
			isLoading: false,
			isSuccess: true,
		});
		renderPanel();
		expect(
			document.querySelector('[data-testid="detected-entities-panel"]'),
		).toBeTruthy();
	});

	it("renders 'No session selected' and a close button when activeSessionId is null", () => {
		mockActiveSessionId = null;
		setupMutationMocks();
		mockGetById.mockReturnValue({ data: undefined, isLoading: false });

		renderPanel();

		expect(screen.getByText(/no session selected/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: /close dock/i })).toBeTruthy();
	});

	it("renders 'Loading session…' when activeSessionId is set but data is loading", () => {
		mockActiveSessionId = SESSION_ID;
		setupMutationMocks();
		mockGetById.mockReturnValue({ data: undefined, isLoading: true });

		renderPanel();

		expect(screen.getByText(/loading session/i)).toBeTruthy();
	});

	it("renders session title input when session data is loaded", () => {
		mockActiveSessionId = SESSION_ID;
		setupMutationMocks();
		mockGetById.mockReturnValue({
			data: draftSession(),
			isLoading: false,
			isSuccess: true,
		});

		renderPanel();

		const titleInput = screen.getByLabelText(
			"Session title",
		) as HTMLInputElement;
		expect(titleInput.value).toBe("The Feast of St. Andral");
	});

	it("clicking the undock button calls undock() and navigates to the full editor", async () => {
		mockActiveSessionId = SESSION_ID;
		mockUndock.mockClear();
		mockNavigate.mockClear();
		setupMutationMocks();
		mockGetById.mockReturnValue({
			data: draftSession(),
			isLoading: false,
			isSuccess: true,
		});

		renderPanel();

		const undockBtn = screen.getByRole("button", { name: /undock session/i });
		fireEvent.click(undockBtn);

		expect(mockUndock).toHaveBeenCalledTimes(1);

		await waitFor(() => {
			expect(mockNavigate).toHaveBeenCalledWith(
				`/campaign/${CAMPAIGN_ID}/sessions/${SESSION_ID}`,
			);
		});
	});
});
