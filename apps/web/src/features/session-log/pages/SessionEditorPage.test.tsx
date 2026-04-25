import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../test-utils.js";

// Mock CampaignChromeContext before any imports that reference it
vi.mock("@/layouts/CampaignChromeContext.js", () => ({
	useCampaignChrome: vi.fn(() => ({
		isDocked: false,
		dockSession: vi.fn(),
		undock: vi.fn(),
		setActiveSessionId: vi.fn(),
		openNotes: vi.fn(),
	})),
}));

// Mock trpc before any imports that reference it
vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		session: {
			getById: { useQuery: vi.fn() },
			list: { useQuery: vi.fn() },
			update: { useMutation: vi.fn() },
			finalize: { useMutation: vi.fn() },
			create: { useMutation: vi.fn() },
		},
		entity: {
			detectSpans: { useQuery: vi.fn(() => ({ data: [], isLoading: false })) },
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

import { trpc } from "@/lib/trpc.js";
import { SessionEditorPage } from "./SessionEditorPage.js";

const mockGetById = trpc.session.getById.useQuery as ReturnType<typeof vi.fn>;
const mockList = trpc.session.list.useQuery as ReturnType<typeof vi.fn>;
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
		sessionNumber: 9,
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

type SessionData = Omit<ReturnType<typeof draftSession>, "status"> & {
	status: string;
};

function setupMocks(overrides: { session?: SessionData }) {
	mockGetById.mockReturnValue({
		data: overrides.session ?? draftSession(),
		isLoading: false,
		isSuccess: true,
	});
	mockList.mockReturnValue({
		data: [overrides.session ?? draftSession()],
		isLoading: false,
		isSuccess: true,
	});
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

function renderPage(sessionId = SESSION_ID) {
	return renderWithRouter(
		[
			{
				path: "/campaign/:id/sessions",
				element: <div>SESSION LIST PAGE</div>,
			},
			{
				path: "/campaign/:id/sessions/:sessionId",
				element: <SessionEditorPage />,
			},
		],
		{ initialEntries: [`/campaign/${CAMPAIGN_ID}/sessions/${sessionId}`] },
	);
}

describe("SessionEditorPage", () => {
	it("renders the sticky header with back link and Save Session button for a draft", () => {
		setupMocks({});
		renderPage();
		expect(screen.getByRole("link", { name: /sessions/i })).toBeTruthy();
		expect(screen.getByRole("button", { name: /save session/i })).toBeTruthy();
	});

	it("renders the session title inside the metadata block", () => {
		setupMocks({});
		renderPage();
		const titleInput = screen.getByLabelText(
			"Session title",
		) as HTMLInputElement;
		expect(titleInput.value).toBe("The Feast of St. Andral");
	});

	it("renders the editor placeholder", () => {
		setupMocks({});
		renderPage();
		expect(
			document.querySelector('[data-placeholder*="Start writing"]'),
		).toBeTruthy();
	});

	it("renders the finalized overline and Update button when session is finalized", () => {
		setupMocks({
			session: { ...draftSession(), status: "finalized" as const },
		});
		renderPage();
		expect(screen.getByRole("button", { name: /update/i })).toBeTruthy();
		const overline = screen.getByTestId("session-overline");
		expect(overline.textContent).toMatch(/✓/);
		expect(overline.textContent).not.toMatch(/DRAFT/);
	});

	it("renders a Dock button in the header for a draft session", () => {
		setupMocks({});
		renderPage();
		expect(screen.getByRole("button", { name: /dock/i })).toBeTruthy();
	});
});
