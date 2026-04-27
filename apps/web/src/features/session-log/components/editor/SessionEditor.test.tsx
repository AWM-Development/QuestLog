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

describe("SessionEditor", () => {
	it("editor canvas root has no card chrome (no background-color, no border in inline style)", async () => {
		render(
			<SessionEditor
				sessionId="cp1-test"
				campaignId="11111111-1111-1111-1111-111111111111"
				content=""
				placeholder="Write here."
				onContentChange={vi.fn()}
			/>,
		);
		await waitFor(() => {
			expect(document.querySelector(".session-editor-root")).toBeTruthy();
		});
		const canvas = document.querySelector('[data-testid="session-editor-canvas"]');
		expect(canvas).toBeTruthy();
		const style = (canvas as HTMLElement).getAttribute("style") ?? "";
		expect(style).not.toContain("background");
		expect(style).not.toContain("border");
	});

	it("mounts a TipTap editor with placeholder", async () => {
		const onContentChange = vi.fn();
		render(
			<SessionEditor
				sessionId="00000000-0000-0000-0000-000000000001"
				campaignId="11111111-1111-1111-1111-111111111111"
				content=""
				placeholder="Write here."
				onContentChange={onContentChange}
			/>,
		);

		await waitFor(() => {
			expect(document.querySelector(".session-editor-root")).toBeTruthy();
		});

		expect(
			document.querySelector('[data-placeholder="Write here."]'),
		).toBeTruthy();
	});

	it("registers the entityHighlight extension", async () => {
		const onContentChange = vi.fn();
		let capturedExtensions: Array<{ name: string }> | null = null;

		render(
			<SessionEditor
				sessionId="00000000-0000-0000-0000-000000000002"
				campaignId="11111111-1111-1111-1111-111111111111"
				content=""
				placeholder="Write here."
				onContentChange={onContentChange}
				onEditorReady={(ed) => {
					capturedExtensions = ed.extensionManager.extensions as Array<{
						name: string;
					}>;
				}}
			/>,
		);

		await waitFor(() => {
			expect(capturedExtensions).not.toBeNull();
		});

		const exts: Array<{ name: string }> = capturedExtensions ?? [];
		const names = exts.map((e) => e.name);
		expect(names).toContain("entityHighlight");
	});
});
