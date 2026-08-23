import { BrowserRouter, Route, Routes } from "react-router";
import { ChromeHeader } from "./components/ChromeHeader.js";
import { LogPage } from "./features/log/LogPage.js";
import { TrendsPage } from "./features/trends/components/TrendsPage.js";

export default function App() {
	return (
		<BrowserRouter>
			<ChromeHeader />
			<Routes>
				<Route path="/" element={<TrendsPage />} />
				<Route path="/log" element={<LogPage />} />
			</Routes>
		</BrowserRouter>
	);
}
