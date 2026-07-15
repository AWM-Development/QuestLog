import { z } from "zod";

export const SessionCreateInput = z.object({
	campaignId: z.string().uuid(),
	title: z.string().max(200).optional(),
	content: z.string().optional(),
});
export type SessionCreateInput = z.infer<typeof SessionCreateInput>;

export const SessionUpdateInput = z.object({
	id: z.string().uuid(),
	title: z.string().max(200).optional().nullable(),
	content: z.string().optional(),
	summary: z.string().max(2000).optional().nullable(),
	tags: z.array(z.string().max(100)).max(50).optional(),
	sessionNumber: z.number().int().positive().optional(),
	date: z.coerce.date().optional(),
	dismissedEntityTexts: z.array(z.string()).optional(),
});
export type SessionUpdateInput = z.infer<typeof SessionUpdateInput>;

export const SessionFinalizeInput = z.object({
	id: z.string().uuid(),
	title: z.string().max(200).optional().nullable(),
	summary: z.string().max(2000).optional().nullable(),
	tags: z.array(z.string().max(100)).max(50).optional(),
	sessionNumber: z.number().int().positive().optional(),
	date: z.coerce.date().optional(),
});
export type SessionFinalizeInput = z.infer<typeof SessionFinalizeInput>;

export const SessionListInput = z.object({
	campaignId: z.string().uuid(),
});
export type SessionListInput = z.infer<typeof SessionListInput>;

export const LogSessionInput = z.object({
	campaignId: z.string().uuid(),
	content: z.string().min(1),
	title: z.string().max(200).optional(),
	summary: z.string().max(2000).optional(),
	tags: z.array(z.string().max(100)).max(50).optional(),
	sessionNumber: z.number().int().positive().optional(),
	date: z.coerce.date().optional(),
});
export type LogSessionInput = z.infer<typeof LogSessionInput>;

export const ConfirmLogSessionInput = z.object({
	token: z.string().uuid(),
});
export type ConfirmLogSessionInput = z.infer<typeof ConfirmLogSessionInput>;
