import { z } from "zod";

export const GovernorVerdictSchema = z.enum(["PASS", "FAIL", "STOP"]);

export const GovernorRuleResultSchema = z.object({
  rule: z.string(),
  verdict: GovernorVerdictSchema,
  message: z.string(),
  details: z.unknown().optional(),
});

export const GovernorResultSchema = z.object({
  overallVerdict: GovernorVerdictSchema,
  rules: z.array(GovernorRuleResultSchema),
  itemFlags: z.array(z.object({
    itemIndex: z.number(),
    reviewRequired: z.boolean(),
    reasons: z.array(z.string()),
  })).optional(),
});

export type GovernorVerdict = z.infer<typeof GovernorVerdictSchema>;
export type GovernorRuleResult = z.infer<typeof GovernorRuleResultSchema>;
export type GovernorResult = z.infer<typeof GovernorResultSchema>;
