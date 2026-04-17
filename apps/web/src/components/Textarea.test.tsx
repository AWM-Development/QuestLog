import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Textarea } from "./primitives/Textarea.js";

describe("Textarea", () => {
	it("renders a textarea element", () => {
		render(<Textarea aria-label="notes" />);
		expect(screen.getByLabelText("notes")).toBeInstanceOf(HTMLTextAreaElement);
	});

	it("applies focus ring styles on focus", () => {
		render(<Textarea aria-label="notes" />);
		const el = screen.getByLabelText("notes");
		fireEvent.focus(el);
		expect(el).toHaveStyle({ boxShadow: "0 0 0 3px var(--state-active-soft)" });
	});

	it("background override takes effect", () => {
		render(<Textarea aria-label="notes" background="var(--bg-void)" />);
		expect(screen.getByLabelText("notes")).toHaveStyle({
			backgroundColor: "var(--bg-void)",
		});
	});

	it("forwards ref to the underlying textarea", () => {
		const ref = createRef<HTMLTextAreaElement>();
		render(<Textarea ref={ref} aria-label="notes" />);
		expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
	});

	it("invokes consumer onChange", () => {
		const onChange = vi.fn();
		render(<Textarea aria-label="notes" onChange={onChange} />);
		fireEvent.change(screen.getByLabelText("notes"), {
			target: { value: "hi" },
		});
		expect(onChange).toHaveBeenCalled();
	});
});
