import { RouterProvider } from "react-router";
import { router } from "./router.js";

export default function App() {
	return <RouterProvider router={router} />;
}
