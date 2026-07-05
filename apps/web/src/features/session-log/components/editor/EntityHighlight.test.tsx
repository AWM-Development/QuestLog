import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionEditor } from "./SessionEditor.js";

vi.mock("@/lib/trpc.js", () => {
	const mockTrpc = {
		entity: {
			detectSpans: {
				useQuery: vi.fn(() => ({ data: [], isLoading: false })),
			},
			create: {
				useMutation: vi.fn(() => ({
					mutateAsync: vi.fn().mockResolvedValue({}),
					isPending: false,
				})),
			},
		},
		useUtils: vi.fn(() => ({
			entity: {
				detectSpans: { fetch: vi.fn().mockResolvedValue([]) },
			},
		})),
	};
	return { trpc: mockTrpc, createTRPCClient: vi.fn(() => ({})) };
});

describe("CP-5: entity-highlight CSS classes", () => {
	it("renders a confirmed NPC span with correct CSS classes from saved content", async () => {
		const confirmedNpcContent = JSON.stringify({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "text",
							text: "Strahd",
							marks: [
								{
									type: "entityHighlight",
									attrs: {
										entityId: "some-entity-id",
										entityType: "npc",
										state: "confirmed",
										candidates: "[]",
									},
								},
							],
						},
					],
				},
			],
		});

		render(
			<SessionEditor
				sessionId="cp5-test"
				campaignId="11111111-1111-1111-1111-111111111111"
				content={confirmedNpcContent}
				placeholder="Write here."
				onContentChange={vi.fn()}
			/>,
		);

		await waitFor(() => {
			const span = document.querySelector('[data-entity-state="confirmed"]');
			expect(span).toBeTruthy();
		});

		const span = document.querySelector('[data-entity-state="confirmed"]');
		expect(span?.classList.contains("entity-span--confirmed")).toBe(true);
		expect(span?.classList.contains("entity-span--npc")).toBe(true);
	});
});
