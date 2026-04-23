import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormField } from "./FormField.js";
import { Input } from "./Input.js";

describe("Input", () => {
	it("renders an input element", () => {
		render(<Input placeholder="Type here" />);
		expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
	});

	it("applies inputField base styles", () => {
		render(<Input placeholder="test" />);
		const input = screen.getByPlaceholderText("test");
		expect(input).toHaveStyle({ borderRadius: "var(--r-md)" });
	});

	it("accepts standard input attributes", () => {
		render(<Input type="number" min={1} placeholder="num" />);
		expect(screen.getByPlaceholderText("num")).toHaveAttribute(
			"type",
			"number",
		);
	});

	it("calls onChange", () => {
		const onChange = vi.fn();
		render(<Input placeholder="x" onChange={onChange} />);
		fireEvent.change(screen.getByPlaceholderText("x"), {
			target: { value: "hello" },
		});
		expect(onChange).toHaveBeenCalledTimes(1);
	});
});

describe("FormField", () => {
	it("renders label text", () => {
		render(
			<FormField label="Name">
				<Input placeholder="name" />
			</FormField>,
		);
		expect(screen.getByText("Name")).toBeInTheDocument();
	});

	it("shows required indicator when required=true", () => {
		render(
			<FormField label="Email" required>
				<Input placeholder="email" />
			</FormField>,
		);
		expect(screen.getByText("*")).toBeInTheDocument();
	});

	it("shows error message when error prop is set", () => {
		render(
			<FormField label="Field" error="Required">
				<Input placeholder="field" />
			</FormField>,
		);
		expect(screen.getByText("Required")).toBeInTheDocument();
	});

	it("does not show error when error prop is absent", () => {
		render(
			<FormField label="Field">
				<Input placeholder="field" />
			</FormField>,
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("renders children (the input)", () => {
		render(
			<FormField label="Title">
				<Input placeholder="Enter title" />
			</FormField>,
		);
		expect(screen.getByPlaceholderText("Enter title")).toBeInTheDocument();
	});
});
