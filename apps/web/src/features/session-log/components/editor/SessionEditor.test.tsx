import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionEditor } from "./SessionEditor.js";

describe("SessionEditor", () => {
	it("mounts a TipTap editor with placeholder", async () => {
		const onContentChange = vi.fn();
		render(
			<SessionEditor
				sessionId="00000000-0000-0000-0000-000000000001"
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
});
