import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	type RenderOptions,
	type RenderResult,
	render,
} from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { createTRPCClient, trpc } from "./lib/trpc.js";

interface RouterOptions {
	initialEntries?: string[];
}

/**
 * tRPC + React Query wrapper for tests that render `Rail`, `AppShell`, or full `App` routes.
 */
export function TrpcTestProvider({ children }: { children: ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: { queries: { retry: false } },
			}),
	);
	const [trpcClient] = useState(createTRPCClient);
	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</trpc.Provider>
	);
}

/**
 * Render a route tree using createMemoryRouter.
 * Does NOT include tRPC/QueryClient providers — tests that need real
 * tRPC should add them manually; tests that mock tRPC hooks don't need them.
 */
export function renderWithRouter(
	routes: Parameters<typeof createMemoryRouter>[0],
	{
		initialEntries = ["/"],
		...renderOptions
	}: RouterOptions & Omit<RenderOptions, "wrapper"> = {},
): RenderResult {
	const router = createMemoryRouter(routes, { initialEntries });

	return render(<RouterProvider router={router} />, renderOptions);
}

/** Like `renderWithRouter` but wraps with `TrpcTestProvider` (required for `Rail` / `AppShell`). */
export function renderWithRouterAndTrpc(
	routes: Parameters<typeof createMemoryRouter>[0],
	{
		initialEntries = ["/"],
		...renderOptions
	}: RouterOptions & Omit<RenderOptions, "wrapper"> = {},
): RenderResult {
	const router = createMemoryRouter(routes, { initialEntries });
	return render(
		<TrpcTestProvider>
			<RouterProvider router={router} />
		</TrpcTestProvider>,
		renderOptions,
	);
}
