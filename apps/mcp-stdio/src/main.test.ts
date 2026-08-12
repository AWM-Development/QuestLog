import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// main.ts's fallible startup steps (storage init, db init, server.connect)
// are mocked here rather than exercised for real — this suite proves the
// diagnosable-error/success-logging behavior main() wraps around them, not
// the steps themselves (those have their own coverage). See
// apps/mcp-stdio/README.md's Troubleshooting section for why a real
// Postgres/StdioServerTransport isn't needed to prove this.

const {
	mockCreateLocalFilesystemStorage,
	mockDbModule,
	mockCreateMcpServer,
	mockConnect,
} = vi.hoisted(() => {
	return {
		mockCreateLocalFilesystemStorage: vi.fn(),
		mockDbModule: vi.fn(),
		mockCreateMcpServer: vi.fn(),
		mockConnect: vi.fn(),
	};
});

// db/index.ts validates DATABASE_URL and opens a connection at module-load
// time (see main.ts's own comment on why its import is dynamic). A getter
// (rather than calling mockDbModule() directly in the factory) is
// deliberate: throwing straight out of a vi.mock factory gets swallowed and
// replaced with a generic Vitest mocking error, losing the real message —
// a throwing getter surfaces on the `{ db } = await import(...)` destructure
// inside main()'s own try/catch instead, same as the real module's eager
// top-level throw would from the caller's point of view.
vi.mock("@questlog/core/db/index.js", () => ({
	get db() {
		return mockDbModule();
	},
}));

vi.mock("@questlog/core/services/storage.service.js", () => ({
	createLocalFilesystemStorage: mockCreateLocalFilesystemStorage,
}));

vi.mock("@questlog/mcp/server.js", () => ({
	createMcpServer: mockCreateMcpServer,
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
	StdioServerTransport: vi.fn(),
}));

describe("main", () => {
	const consoleErrorSpy = vi
		.spyOn(console, "error")
		.mockImplementation(() => undefined as never);
	const processExitSpy = vi
		.spyOn(process, "exit")
		.mockImplementation(() => undefined as never);

	beforeEach(() => {
		consoleErrorSpy.mockClear();
		processExitSpy.mockClear();
		vi.resetModules();
		mockCreateLocalFilesystemStorage.mockReset().mockReturnValue({});
		mockDbModule.mockReset().mockReturnValue({});
		mockCreateMcpServer.mockReset().mockReturnValue({ connect: mockConnect });
		mockConnect.mockReset().mockResolvedValue(undefined);
	});

	afterAll(() => {
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();
	});

	it("logs a diagnosable message and exits 1 when storage init fails", async () => {
		const storageError = new Error("EACCES: permission denied, uploads");
		mockCreateLocalFilesystemStorage.mockImplementation(() => {
			throw storageError;
		});

		const { main } = await import("./main.js");
		await main();

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("storage init"),
		);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("EACCES: permission denied, uploads"),
		);
		expect(processExitSpy).toHaveBeenCalledWith(1);
		expect(mockCreateMcpServer).not.toHaveBeenCalled();
	});

	it("logs a diagnosable message and exits 1 when database init fails (e.g. a bad DATABASE_URL)", async () => {
		const dbError = new Error(
			"DATABASE_URL is set but is not a valid postgres connection string (failed to parse as a URL) — check for stray whitespace, quotes, or a missing scheme.",
		);
		mockDbModule.mockImplementation(() => {
			throw dbError;
		});

		const { main } = await import("./main.js");
		await main();

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("database init"),
		);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("DATABASE_URL is set but is not a valid"),
		);
		expect(processExitSpy).toHaveBeenCalledWith(1);
		expect(mockCreateMcpServer).not.toHaveBeenCalled();
	});

	it("logs a diagnosable message and exits 1 when server.connect rejects", async () => {
		const connectError = new Error("EADDRINUSE: address already in use");
		mockConnect.mockRejectedValue(connectError);

		const { main } = await import("./main.js");
		await main();

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("server connect"),
		);
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("EADDRINUSE: address already in use"),
		);
		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	it("logs a ready message on success", async () => {
		const { main } = await import("./main.js");
		await main();

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"QuestLog MCP server ready (stdio)",
		);
		expect(processExitSpy).not.toHaveBeenCalled();
	});
});
