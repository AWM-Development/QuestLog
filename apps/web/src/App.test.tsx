import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./layouts/AppShell.js";
import { renderWithRouter } from "./test-utils.js";

describe("App", () => {
	it("renders the QuestLog brand", () => {
		renderWithRouter(
			[
				{
					path: "/",
					element: <AppShell />,
					children: [{ index: true, element: <p>Home</p> }],
				},
			],
			{ initialEntries: ["/"] },
		);

		expect(screen.getByText("QuestLog")).toBeInTheDocument();
	});
});
