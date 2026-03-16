import { z } from "zod";
import { SOURCE_STATUSES } from "../constants/index.js";

export const SourceStatusSchema = z.enum(SOURCE_STATUSES);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

/** Source kind: file upload vs pasted text (type column in DB). */
export const SourceKindSchema = z.enum(["file", "pasted_text"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

/** Input for uploading a file source. Content sent as base64 for JSON transport. */
export const UploadSourceInput = z.object({
	campaignId: z.string().uuid(),
	filename: z.string().min(1).max(255),
	mimeType: z.string().min(1).max(128),
	sizeBytes: z.number().int().nonnegative(),
	contentBase64: z.string().min(1),
});
export type UploadSourceInput = z.infer<typeof UploadSourceInput>;

/** Source DTO returned by getSource / listSources (no internal storageKey in response if desired). */
export const SourceSchema = z.object({
	id: z.string().uuid(),
	campaignId: z.string().uuid(),
	name: z.string(),
	type: z.string(),
	mimeType: z.string().nullable(),
	storageKey: z.string().nullable().optional(),
	sizeBytes: z.number().nullable(),
	hash: z.string().nullable(),
	status: SourceStatusSchema,
	metadata: z.record(z.unknown()).optional(),
	createdAt: z.date(),
	updatedAt: z.date(),
});
export type SourceSchemaType = z.infer<typeof SourceSchema>;

export const GetSourceInput = z.object({ id: z.string().uuid() });
export type GetSourceInput = z.infer<typeof GetSourceInput>;

export const ListSourcesInput = z.object({ campaignId: z.string().uuid() });
export type ListSourcesInput = z.infer<typeof ListSourcesInput>;
