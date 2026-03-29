import { db } from "@/infra/db";
import { auditLogs } from "@/infra/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { CreateAuditLogInput } from "@/domain/types";

export const auditLogger = {
  async log(input: CreateAuditLogInput) {
    const id = crypto.randomUUID();
    await db.insert(auditLogs).values({
      id,
      actor: input.actor,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      draftId: input.draftId ?? null,
      approvalId: input.approvalId ?? null,
      details: input.details ? JSON.stringify(input.details) : null,
      timestamp: new Date().toISOString(),
    });
    const result = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
    return result[0];
  },

  async findAll(options?: { limit?: number; offset?: number; draftId?: string }) {
    if (options?.draftId) {
      return db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.draftId, options.draftId))
        .orderBy(desc(auditLogs.timestamp))
        .limit(options?.limit ?? 100)
        .offset(options?.offset ?? 0);
    }

    return db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);
  },

  async findByDraftId(draftId: string) {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.draftId, draftId))
      .orderBy(asc(auditLogs.timestamp));
  },
};
