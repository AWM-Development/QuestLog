import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "./Alert.js";

describe("Alert", () => {
	it("renders children", () => {
		render(<Alert>Something went wrong</Alert>);
		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});

	it("defaults to role=alert for error variant", () => {
		render(<Alert>Error</Alert>);
		expect(screen.getByRole("alert")).toBeInTheDocument();
	});

	it("defaults to role=status for warning variant", () => {
		render(<Alert variant="warning">Heads up</Alert>);
		expect(screen.getByRole("status")).toBeInTheDocument();
	});

	it("honors explicit role override", () => {
		render(
			<Alert variant="warning" role="alert">
				Upgraded urgency
			</Alert>,
		);
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

	it("error variant applies status-error color to container", () => {
		render(<Alert>Error</Alert>);
		expect(screen.getByRole("alert")).toHaveStyle({
			color: "var(--status-error)",
		});
	});

	it("warning variant applies status-warning color to container", () => {
		render(<Alert variant="warning">Warn</Alert>);
		expect(screen.getByRole("status")).toHaveStyle({
			color: "var(--status-warning)",
		});
	});

	it("inline layout uses inline alert padding", () => {
		render(
			<Alert variant="error" layout="inline">
				Inline
			</Alert>,
		);
		expect(screen.getByRole("alert")).toHaveStyle({
			padding: "var(--space-3) var(--space-4)",
		});
	});

	it("inline layout renders children that include block elements (no <p> wrap)", () => {
		render(
			<Alert variant="warning" layout="inline">
				<div>
					<button type="button">Action</button>
				</div>
			</Alert>,
		);
		expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
	});
});
