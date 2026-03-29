import { db } from "@/infra/db";
import { approvals } from "@/infra/db/schema";
import { eq, desc } from "drizzle-orm";
import { CreateApprovalInput } from "@/domain/types";

export const approvalRepository = {
  async create(draftId: string, input: CreateApprovalInput) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(approvals).values({
      id,
      draftId,
      action: input.action,
      comment: input.comment ?? null,
      isDryRun: input.isDryRun,
      createdAt: now,
    });
    const result = await db.select().from(approvals).where(eq(approvals.id, id));
    return result[0];
  },

  async findByDraftId(draftId: string) {
    return db
      .select()
      .from(approvals)
      .where(eq(approvals.draftId, draftId))
      .orderBy(desc(approvals.createdAt));
  },
};
