import { z } from "zod";

export const EvaluationCriterionSchema = z.enum([
  "no_conflict",
  "time_feasible",
  "deadline_priority",
  "explainable_reason",
]);

export const EvaluationItemResultSchema = z.object({
  criterion: EvaluationCriterionSchema,
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  message: z.string(),
});

export const EvaluationResultSchema = z.object({
  overallScore: z.number().min(0).max(1),
  passed: z.boolean(),
  criteria: z.array(EvaluationItemResultSchema),
});

export type EvaluationCriterion = z.infer<typeof EvaluationCriterionSchema>;
export type EvaluationItemResult = z.infer<typeof EvaluationItemResultSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
