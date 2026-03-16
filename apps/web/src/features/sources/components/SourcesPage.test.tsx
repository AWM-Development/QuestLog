import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../test-utils.js";

// Mock trpc before any imports that reference it
vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		source: {
			list: { useQuery: vi.fn() },
			importText: { useMutation: vi.fn() },
			checkDuplicate: { useQuery: vi.fn() },
			delete: { useMutation: vi.fn() },
		},
		useUtils: vi.fn(() => ({
			source: { list: { invalidate: vi.fn() } },
		})),
	};
	return {
		trpc: mockTrpc,
		createTRPCClient: vi.fn(() => ({})),
	};
});

import { trpc } from "@/lib/trpc.js";
import { SourcesPage } from "./SourcesPage.js";

const mockList = trpc.source.list.useQuery as ReturnType<typeof vi.fn>;
const mockImportText = trpc.source.importText.useMutation as ReturnType<
	typeof vi.fn
>;

function setupMocks() {
	mockImportText.mockReturnValue({
		mutate: vi.fn(),
		isPending: false,
		isError: false,
		error: null,
		isSuccess: false,
		reset: vi.fn(),
	});
}

function renderSourcesPage(
	campaignId = "00000000-0000-0000-0000-000000000001",
) {
	setupMocks();
	return renderWithRouter(
		[{ path: "/campaign/:id/sources", element: <SourcesPage /> }],
		{ initialEntries: [`/campaign/${campaignId}/sources`] },
	);
}

describe("SourcesPage", () => {
	it("renders the page heading and drop zone", () => {
		mockList.mockReturnValue({
			isLoading: false,
			isError: false,
			data: [],
		});

		renderSourcesPage();

		expect(
			screen.getByRole("heading", { name: /import campaign material/i }),
		).toBeInTheDocument();
		expect(screen.getByText("Drop files here")).toBeInTheDocument();
	});

	it("shows loading state while fetching sources", () => {
		mockList.mockReturnValue({
			isLoading: true,
			isError: false,
			data: undefined,
		});

		renderSourcesPage();

		expect(screen.getByLabelText("Loading sources")).toBeInTheDocument();
	});

	it("shows empty state when no sources exist", () => {
		mockList.mockReturnValue({
			isLoading: false,
			isError: false,
			data: [],
		});

		renderSourcesPage();

		expect(screen.getByText(/no sources yet/i)).toBeInTheDocument();
	});

	it("shows Active imports section only when active sources exist", () => {
		mockList.mockReturnValue({
			isLoading: false,
			isError: false,
			data: [
				{
					id: "1",
					campaignId: "c1",
					name: "processing.txt",
					type: "text",
					mimeType: null,
					sizeBytes: 100,
					hash: "h1",
					status: "extracting",
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
		});

		renderSourcesPage();

		expect(screen.getByText("Active imports")).toBeInTheDocument();
	});

	it("hides Active imports section when no active sources", () => {
		mockList.mockReturnValue({
			isLoading: false,
			isError: false,
			data: [
				{
					id: "1",
					campaignId: "c1",
					name: "done.txt",
					type: "text",
					mimeType: null,
					sizeBytes: 100,
					hash: "h1",
					status: "done",
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
		});

		renderSourcesPage();

		expect(screen.queryByText("Active imports")).not.toBeInTheDocument();
	});

	it("shows completed sources in Campaign sources section", () => {
		mockList.mockReturnValue({
			isLoading: false,
			isError: false,
			data: [
				{
					id: "1",
					campaignId: "c1",
					name: "curse-of-strahd.pdf",
					type: "pdf",
					mimeType: null,
					sizeBytes: 5000,
					hash: "h1",
					status: "done",
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
		});

		renderSourcesPage();

		expect(screen.getByText("Campaign sources")).toBeInTheDocument();
		expect(screen.getByText("curse-of-strahd.pdf")).toBeInTheDocument();
	});
});
