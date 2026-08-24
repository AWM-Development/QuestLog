import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver (no layout engine to observe) — recharts'
// ResponsiveContainer needs one to mount at all. A no-op stub is enough
// since these tests assert on data/DOM structure, never on rendered pixel
// dimensions.
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
// biome-ignore lint/suspicious/noExplicitAny: polyfilling a missing jsdom global
(globalThis as any).ResizeObserver ??= ResizeObserverStub;
