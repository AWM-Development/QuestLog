import { z } from "zod";

export const AddItemInput = z.object({
	campaignId: z.string().uuid(),
	name: z.string().min(1).max(200),
	description: z.string().max(2000).optional(),
	quantity: z.number().int().min(1).optional(),
	value: z.number().int().min(0).optional(),
	ownerEntityId: z.string().uuid().optional(),
});
export type AddItemInput = z.infer<typeof AddItemInput>;

// ownerEntityId is required (not optional) here, unlike AddItemInput's — a
// transfer always states its target explicitly; null clears to the
// unassigned/shared pool rather than being omitted. campaignId is mandatory
// per .claude/rules/mcp.md "Campaign-scoped ID lookups" (T-068) — see
// IMPLEMENTATION_NOTES.md's T-143 entry for why.
export const TransferItemInput = z.object({
	campaignId: z.string().uuid(),
	itemId: z.string().uuid(),
	ownerEntityId: z.string().uuid().nullable(),
});
export type TransferItemInput = z.infer<typeof TransferItemInput>;

export const AdjustWealthInput = z.object({
	campaignId: z.string().uuid(),
	delta: z.number().int(),
	denomination: z.string().min(1).max(50).optional(),
});
export type AdjustWealthInput = z.infer<typeof AdjustWealthInput>;

export const ListInventoryInput = z.object({
	campaignId: z.string().uuid(),
	ownerEntityId: z.string().uuid().optional(),
});
export type ListInventoryInput = z.infer<typeof ListInventoryInput>;
