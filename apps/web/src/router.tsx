import { Navigate, createBrowserRouter } from "react-router";
import { PlaceholderPage } from "./components/PlaceholderPage.js";
import { CampaignListPage } from "./features/campaigns/index.js";
import { SourcesPage } from "./features/sources/index.js";
import { AppShell } from "./layouts/AppShell.js";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <AppShell />,
		children: [
			{ index: true, element: <Navigate to="/campaigns" replace /> },
			{ path: "campaigns", element: <CampaignListPage /> },
			{
				path: "campaign/:id",
				children: [
					{
						index: true,
						element: <PlaceholderPage title="Campaign Home" />,
					},
					{
						path: "chat",
						element: <PlaceholderPage title="Agent Chat" />,
					},
					{
						path: "sessions",
						element: <PlaceholderPage title="Session Logs" />,
					},
					{
						path: "entities",
						element: <PlaceholderPage title="Entities" />,
					},
					{
						path: "prep",
						element: <PlaceholderPage title="Session Prep" />,
					},
					{
						path: "sources",
						element: <SourcesPage />,
					},
					{
						path: "settings",
						element: <PlaceholderPage title="Settings" />,
					},
				],
			},
		],
	},
]);
