import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./primitives/FormField.js";
import { Input } from "./primitives/Input.js";

describe("FormField", () => {
	it("renders label text", () => {
		render(
			<FormField label="Name">
				<Input aria-label="name-input" />
			</FormField>,
		);
		expect(screen.getByText("Name")).toBeInTheDocument();
	});

	it("renders required asterisk when required is true", () => {
		render(
			<FormField label="Name" required>
				<Input />
			</FormField>,
		);
		expect(screen.getByText("*", { exact: false })).toBeInTheDocument();
	});

	it("auto-generates id and binds label to child input when htmlFor is omitted", () => {
		render(
			<FormField label="Title">
				<Input />
			</FormField>,
		);
		const label = screen.getByText("Title") as HTMLLabelElement;
		const input = screen.getByRole("textbox") as HTMLInputElement;
		expect(label.getAttribute("for")).toBeTruthy();
		expect(input.id).toBe(label.getAttribute("for"));
	});

	it("honors explicit htmlFor + child id", () => {
		render(
			<FormField label="Name" htmlFor="name-field">
				<Input id="name-field" />
			</FormField>,
		);
		const label = screen.getByText("Name") as HTMLLabelElement;
		expect(label.getAttribute("for")).toBe("name-field");
		expect(screen.getByRole("textbox").id).toBe("name-field");
	});

	it("does not override a child id when one is provided", () => {
		render(
			<FormField label="Custom">
				<Input id="custom-id" />
			</FormField>,
		);
		expect(screen.getByRole("textbox").id).toBe("custom-id");
	});

	it("renders error message with role=alert", () => {
		render(
			<FormField label="X" error="Required">
				<Input />
			</FormField>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent("Required");
	});

	it("renders hint when no error", () => {
		render(
			<FormField label="X" hint="Keep it short">
				<Input />
			</FormField>,
		);
		expect(screen.getByText("Keep it short")).toBeInTheDocument();
	});

	it("suppresses hint when error is present", () => {
		render(
			<FormField label="X" hint="Keep it short" error="Required">
				<Input />
			</FormField>,
		);
		expect(screen.queryByText("Keep it short")).not.toBeInTheDocument();
	});

	it("compact label uses muted style", () => {
		render(
			<FormField label="X" compact>
				<Input />
			</FormField>,
		);
		const label = screen.getByText("X") as HTMLLabelElement;
		expect(label).toHaveStyle({ fontSize: "0.6875rem" });
	});
});
