/**
 * tRPC hook wrappers for the sources feature.
 * Import from here rather than calling trpc.source.* directly in components —
 * it centralises the API surface and makes mocking in tests cleaner.
 */
export { trpc } from "@/lib/trpc.js";
