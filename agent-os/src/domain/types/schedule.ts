import { z } from "zod";

export const BlockTypeSchema = z.enum(["focus", "meeting", "break", "admin", "review"]);
export const DraftStatusSchema = z.enum(["draft", "validated", "approved", "applied", "rejected"]);

export const ScheduleDraftItemSchema = z.object({
  id: z.string().uuid(),
  draftId: z.string().uuid(),
  taskId: z.string().uuid().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  startTime: z.date(),
  endTime: z.date(),
  blockType: BlockTypeSchema,
  reason: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
  order: z.number().int(),
});

export type ScheduleDraftItem = z.infer<typeof ScheduleDraftItemSchema>;
export type BlockType = z.infer<typeof BlockTypeSchema>;

export const ScheduleDraftSchema = z.object({
  id: z.string().uuid(),
  targetDate: z.date(),
  status: DraftStatusSchema,
  plannerOutput: z.unknown().nullable(),
  validationResult: z.unknown().nullable(),
  evaluationResult: z.unknown().nullable(),
  items: z.array(ScheduleDraftItemSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ScheduleDraft = z.infer<typeof ScheduleDraftSchema>;
export type DraftStatus = z.infer<typeof DraftStatusSchema>;
