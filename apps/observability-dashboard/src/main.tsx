import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { createTRPCClient, trpc } from "./lib/trpc.js";
import "./index.css";

function Root() {
	const [queryClient] = useState(() => new QueryClient());
	const [trpcClient] = useState(createTRPCClient);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				<App />
			</QueryClientProvider>
		</trpc.Provider>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
	<StrictMode>
		<Root />
	</StrictMode>,
);
