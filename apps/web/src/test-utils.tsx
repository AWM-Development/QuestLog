import {
	type RenderOptions,
	type RenderResult,
	render,
} from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";

interface RouterOptions {
	initialEntries?: string[];
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
