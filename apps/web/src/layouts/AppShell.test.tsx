import { screen } from "@testing-library/react";
import { Outlet } from "react-router";
import { describe, expect, it } from "vitest";
import { renderWithRouterAndTrpc } from "../test-utils.js";
import { AppShell } from "./AppShell.js";

describe("AppShell", () => {
	it("renders the rail navigation", () => {
		renderWithRouterAndTrpc(
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
		renderWithRouterAndTrpc(
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
		renderWithRouterAndTrpc(
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
		renderWithRouterAndTrpc(
			[
				{
					path: "/",
					element: <AppShell />,
					children: [
						{
							path: "campaign/:id",
							element: <Outlet />,
							children: [{ index: true, element: <p>Campaign Home</p> }],
						},
					],
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

	it("keeps rail campaign links correct on nested chat/:conversationId (matches prod route shape)", () => {
		renderWithRouterAndTrpc(
			[
				{
					path: "/",
					element: <AppShell />,
					children: [
						{
							path: "campaign/:id",
							element: <Outlet />,
							children: [
								{
									path: "chat/:conversationId",
									element: <p>Chat</p>,
								},
							],
						},
					],
				},
			],
			{ initialEntries: ["/campaign/abc-123/chat/conv-456"] },
		);

		expect(screen.getByTitle("Session logs")).toHaveAttribute(
			"href",
			"/campaign/abc-123/sessions",
		);
	});

	it("does not render campaign nav icons when on /campaigns", () => {
		renderWithRouterAndTrpc(
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
		renderWithRouterAndTrpc(
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
