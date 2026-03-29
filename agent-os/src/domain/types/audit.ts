import { z } from "zod";

export const AuditActorSchema = z.enum(["system", "user", "planner", "governor", "executor", "evaluator"]);
export const AuditActionSchema = z.enum([
  "plan_generated",
  "plan_validated",
  "plan_evaluation_completed",
  "plan_approved",
  "plan_rejected",
  "plan_changes_requested",
  "plan_applied",
  "plan_apply_failed",
  "plan_dry_run",
  "calendar_synced",
  "slack_notified",
]);
export const AuditResourceSchema = z.enum(["schedule_draft", "calendar_event", "task", "approval"]);

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actor: AuditActorSchema,
  action: AuditActionSchema,
  resource: AuditResourceSchema,
  resourceId: z.string().nullable(),
  draftId: z.string().nullable(),
  approvalId: z.string().nullable(),
  details: z.unknown().nullable(),
  timestamp: z.date(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;
export type AuditActor = z.infer<typeof AuditActorSchema>;
export type AuditAction = z.infer<typeof AuditActionSchema>;
export type AuditResource = z.infer<typeof AuditResourceSchema>;

export const CreateAuditLogSchema = z.object({
  actor: AuditActorSchema,
  action: AuditActionSchema,
  resource: AuditResourceSchema,
  resourceId: z.string().optional(),
  draftId: z.string().optional(),
  approvalId: z.string().optional(),
  details: z.unknown().optional(),
});

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
