import { db } from "@/infra/db";
import { scheduleDrafts, scheduleDraftItems, approvals, tasks } from "@/infra/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { StateTransitionError } from "@/lib/errors";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["validated", "rejected"],
  validated: ["approved", "rejected"],
  approved: ["applied", "rejected"],
  applied: [],
  rejected: [],
};

async function enrichDraft(draft: typeof scheduleDrafts.$inferSelect) {
  const items = await db
    .select()
    .from(scheduleDraftItems)
    .where(eq(scheduleDraftItems.draftId, draft.id))
    .orderBy(asc(scheduleDraftItems.order));

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      let task = null;
      if (item.taskId) {
        const taskResult = await db.select().from(tasks).where(eq(tasks.id, item.taskId));
        task = taskResult[0] ?? null;
      }
      return { ...item, task };
    }),
  );

  const draftApprovals = await db
    .select()
    .from(approvals)
    .where(eq(approvals.draftId, draft.id))
    .orderBy(desc(approvals.createdAt));

  return { ...draft, items: enrichedItems, approvals: draftApprovals };
}

export const draftRepository = {
  async findAll() {
    const allDrafts = await db
      .select()
      .from(scheduleDrafts)
      .orderBy(desc(scheduleDrafts.createdAt));

    return Promise.all(allDrafts.map(enrichDraft));
  },

  async findById(id: string) {
    const result = await db.select().from(scheduleDrafts).where(eq(scheduleDrafts.id, id));
    if (!result[0]) return null;
    return enrichDraft(result[0]);
  },

  async create(data: {
    targetDate: Date;
    plannerOutput: unknown;
    items: Array<{
      taskId?: string;
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      blockType: string;
      reason?: string;
      confidence: number;
      reviewRequired: boolean;
      order: number;
    }>;
  }) {
    const draftId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(scheduleDrafts).values({
      id: draftId,
      targetDate: data.targetDate.toISOString().split("T")[0],
      status: "draft",
      plannerOutput: JSON.stringify(data.plannerOutput),
      createdAt: now,
      updatedAt: now,
    });

    for (const item of data.items) {
      await db.insert(scheduleDraftItems).values({
        id: crypto.randomUUID(),
        draftId,
        taskId: item.taskId ?? null,
        title: item.title,
        description: item.description ?? null,
        startTime: item.startTime.toISOString(),
        endTime: item.endTime.toISOString(),
        blockType: item.blockType,
        reason: item.reason ?? null,
        confidence: item.confidence,
        reviewRequired: item.reviewRequired,
        order: item.order,
        createdAt: now,
        updatedAt: now,
      });
    }

    return this.findById(draftId);
  },

  async updateStatus(id: string, newStatus: string, extraData?: Record<string, unknown>) {
    const result = await db.select().from(scheduleDrafts).where(eq(scheduleDrafts.id, id));
    const draft = result[0];
    if (!draft) throw new Error(`Draft not found: ${id}`);

    const allowed = VALID_TRANSITIONS[draft.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new StateTransitionError(draft.status, newStatus, "ScheduleDraft");
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    if (extraData?.validationResult) updateData.validationResult = extraData.validationResult as string;
    if (extraData?.evaluationResult) updateData.evaluationResult = extraData.evaluationResult as string;

    await db.update(scheduleDrafts).set(updateData).where(eq(scheduleDrafts.id, id));

    return this.findById(id);
  },
};
