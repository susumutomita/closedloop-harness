import { z } from "zod";

export const ApprovalActionSchema = z.enum(["approve", "reject", "request_changes"]);

export const ApprovalSchema = z.object({
  id: z.string().uuid(),
  draftId: z.string().uuid(),
  action: ApprovalActionSchema,
  approver: z.string(),
  comment: z.string().nullable(),
  isDryRun: z.boolean(),
  createdAt: z.date(),
});

export type Approval = z.infer<typeof ApprovalSchema>;
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

export const CreateApprovalSchema = z.object({
  action: ApprovalActionSchema,
  comment: z.string().optional(),
  isDryRun: z.boolean().default(false),
});

export type CreateApprovalInput = z.infer<typeof CreateApprovalSchema>;
