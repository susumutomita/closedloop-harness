import { z } from "zod";

export const TaskStatusSchema = z.enum(["open", "in_progress", "done", "cancelled"]);
export const TaskPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  deadline: z.date().nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
  tags: z.array(z.string()).nullable(),
  isCarryOver: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Task = z.infer<typeof TaskSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: TaskPrioritySchema.default("medium"),
  deadline: z.date().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  isCarryOver: z.boolean().default(false),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
