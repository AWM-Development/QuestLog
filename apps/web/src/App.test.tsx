import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./layouts/AppShell.js";
import { renderWithRouterAndTrpc } from "./test-utils.js";

describe("App", () => {
	it("renders the QuestLog brand", () => {
		renderWithRouterAndTrpc(
			[
				{
					path: "/",
					element: <AppShell />,
					children: [{ index: true, element: <p>Home</p> }],
				},
			],
			{ initialEntries: ["/"] },
		);

		expect(screen.getByTitle("QuestLog")).toBeInTheDocument();
	});
});
