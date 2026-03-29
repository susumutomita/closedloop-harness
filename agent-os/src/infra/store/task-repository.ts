import { db } from "@/infra/db";
import { tasks } from "@/infra/db/schema";
import { eq, inArray, desc, asc } from "drizzle-orm";
import { CreateTaskInput } from "@/domain/types";

export const taskRepository = {
  async findAll() {
    return db.select().from(tasks).orderBy(desc(tasks.priority));
  },

  async findOpen() {
    return db
      .select()
      .from(tasks)
      .where(inArray(tasks.status, ["open", "in_progress"]))
      .orderBy(desc(tasks.priority), asc(tasks.deadline));
  },

  async findById(id: string) {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0] ?? null;
  },

  async create(input: CreateTaskInput) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(tasks).values({
      id,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      deadline: input.deadline?.toISOString() ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      tags: input.tags ? JSON.stringify(input.tags) : null,
      isCarryOver: input.isCarryOver,
      createdAt: now,
      updatedAt: now,
    });
    return (await db.select().from(tasks).where(eq(tasks.id, id)))[0];
  },

  async update(id: string, data: Partial<CreateTaskInput>) {
    await db
      .update(tasks)
      .set({
        ...data,
        deadline: data.deadline?.toISOString(),
        tags: data.tags ? JSON.stringify(data.tags) : undefined,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, id));
    return (await db.select().from(tasks).where(eq(tasks.id, id)))[0];
  },
};
