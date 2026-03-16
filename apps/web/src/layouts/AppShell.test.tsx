import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "../test-utils.js";
import { AppShell } from "./AppShell.js";

describe("AppShell", () => {
	it("renders the rail navigation", () => {
		renderWithRouter(
			[
				{
					path: "/",
					element: <AppShell />,
					children: [{ index: true, element: <p>Content</p> }],
				},
			],
			{ initialEntries: ["/"] },
		);

		expect(screen.getByRole("navigation")).toBeInTheDocument();
	});

	it("renders the main content area", () => {
		renderWithRouter(
			[
				{
					path: "/",
					element: <AppShell />,
					children: [{ index: true, element: <p>Main Content</p> }],
				},
			],
			{ initialEntries: ["/"] },
		);

		expect(screen.getByText("Main Content")).toBeInTheDocument();
	});

	it("renders the QuestLog logo link", () => {
		renderWithRouter(
			[
				{
					path: "/",
					element: <AppShell />,
					children: [{ index: true, element: <p>Content</p> }],
				},
			],
			{ initialEntries: ["/"] },
		);

		expect(screen.getByTitle("QuestLog")).toBeInTheDocument();
	});

	it("renders campaign nav icons when a campaignId is in the URL", () => {
		renderWithRouter(
			[
				{
					path: "/campaign/:id",
					element: <AppShell />,
					children: [{ index: true, element: <p>Campaign Home</p> }],
				},
			],
			{ initialEntries: ["/campaign/abc-123"] },
		);

		expect(screen.getByTitle("Agent chat")).toBeInTheDocument();
		expect(screen.getByTitle("Session logs")).toBeInTheDocument();
		expect(screen.getByTitle("Session prep")).toBeInTheDocument();
		expect(screen.getByTitle("Entities")).toBeInTheDocument();
		expect(screen.getByTitle("Sources")).toBeInTheDocument();
		expect(screen.getByTitle("Settings")).toBeInTheDocument();
	});

	it("does not render campaign nav icons when on /campaigns", () => {
		renderWithRouter(
			[
				{
					path: "/campaigns",
					element: <AppShell />,
					children: [{ index: true, element: <p>List</p> }],
				},
			],
			{ initialEntries: ["/campaigns"] },
		);

		expect(screen.queryByTitle("Agent chat")).not.toBeInTheDocument();
	});

	it("renders the mascot", () => {
		renderWithRouter(
			[
				{
					path: "/",
					element: <AppShell />,
					children: [{ index: true, element: <p>Content</p> }],
				},
			],
			{ initialEntries: ["/"] },
		);

		expect(screen.getByTitle("Ember — idle")).toBeInTheDocument();
	});
});
