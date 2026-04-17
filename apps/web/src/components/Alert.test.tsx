import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "./Alert.js";

describe("Alert", () => {
	it("renders children", () => {
		render(<Alert>Something went wrong</Alert>);
		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});

	it("has role=alert", () => {
		render(<Alert>Error</Alert>);
		expect(screen.getByRole("alert")).toBeInTheDocument();
	});

	it("renders title when provided", () => {
		render(<Alert title="Load failed">Details here</Alert>);
		expect(screen.getByText("Load failed")).toBeInTheDocument();
		expect(screen.getByText("Details here")).toBeInTheDocument();
	});

	it("renders retry button when onRetry is provided", () => {
		render(<Alert onRetry={vi.fn()}>Error</Alert>);
		expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
	});

	it("does not render retry button when onRetry is omitted", () => {
		render(<Alert>Error</Alert>);
		expect(
			screen.queryByRole("button", { name: "Retry" }),
		).not.toBeInTheDocument();
	});

	it("calls onRetry when retry button is clicked", () => {
		const onRetry = vi.fn();
		render(<Alert onRetry={onRetry}>Error</Alert>);
		screen.getByRole("button", { name: "Retry" }).click();
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("applies error color to text", () => {
		render(<Alert>Error</Alert>);
		const el = screen.getByRole("alert");
		expect(el).toHaveStyle({ color: "var(--status-error)" });
	});
});
