import { z } from "zod";
import { BlockTypeSchema } from "./schedule";

export const PlannerConstraintsSchema = z.object({
  workDayStart: z.string().default("09:00"),
  workDayEnd: z.string().default("18:00"),
  maxFocusHours: z.number().default(6),
  minBreakMinutes: z.number().default(15),
  lunchStart: z.string().default("12:00"),
  lunchEnd: z.string().default("13:00"),
});

export type PlannerConstraints = z.infer<typeof PlannerConstraintsSchema>;

export const PlannerInputSchema = z.object({
  targetDate: z.string(),
  existingEvents: z.array(z.object({
    title: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    isMeeting: z.boolean(),
  })),
  openTasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    priority: z.string(),
    deadline: z.string().nullable(),
    estimatedMinutes: z.number().nullable(),
    isCarryOver: z.boolean(),
  })),
  constraints: PlannerConstraintsSchema,
});

export type PlannerInput = z.infer<typeof PlannerInputSchema>;

export const PlannerOutputItemSchema = z.object({
  taskId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable().optional(),
  startTime: z.string(),
  endTime: z.string(),
  blockType: BlockTypeSchema,
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export const PlannerOutputSchema = z.object({
  items: z.array(PlannerOutputItemSchema),
  summary: z.string(),
  warnings: z.array(z.string()).optional(),
});

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;
export type PlannerOutputItem = z.infer<typeof PlannerOutputItemSchema>;
