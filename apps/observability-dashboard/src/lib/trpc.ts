import type { AppRouter } from "@questlog/server/routers/_app.js";
import {
	type CreateTRPCReact,
	createTRPCReact,
	httpBatchLink,
} from "@trpc/react-query";
import superjson from "superjson";

export const trpc: CreateTRPCReact<AppRouter, unknown> =
	createTRPCReact<AppRouter>();

export function createTRPCClient() {
	return trpc.createClient({
		links: [
			httpBatchLink({
				url: import.meta.env.VITE_API_URL,
				transformer: superjson,
			}),
		],
	});
}
