import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "../test-utils.js";
import { AppShell } from "./AppShell.js";

describe("AppShell", () => {
	it("renders the sidebar navigation", () => {
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

	it("renders the QuestLog brand link", () => {
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

		expect(screen.getByText("QuestLog")).toBeInTheDocument();
	});

	it("renders the All Campaigns nav link", () => {
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

		expect(screen.getByText("All Campaigns")).toBeInTheDocument();
	});

	it("renders campaign nav links when a campaignId is in the URL", () => {
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

		expect(screen.getByText("Agent Chat")).toBeInTheDocument();
		expect(screen.getByText("Session Logs")).toBeInTheDocument();
		expect(screen.getByText("Session Prep")).toBeInTheDocument();
		expect(screen.getByText("Entities")).toBeInTheDocument();
		expect(screen.getByText("Sources")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
	});

	it("does not render campaign nav links when on /campaigns", () => {
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

		expect(screen.queryByText("Agent Chat")).not.toBeInTheDocument();
	});

	it("renders the mascot placeholder", () => {
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

		expect(screen.getByText("Mascot")).toBeInTheDocument();
	});
});
