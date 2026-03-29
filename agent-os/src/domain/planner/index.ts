import { PlannerInput, PlannerInputSchema, PlannerOutput } from "@/domain/types";
import { createLLMProvider } from "@/infra/llm/provider";
import { ValidationError } from "@/lib/errors";

export async function generatePlan(rawInput: unknown): Promise<PlannerOutput> {
  const parseResult = PlannerInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new ValidationError("Invalid planner input", parseResult.error.format());
  }

  const input: PlannerInput = parseResult.data;
  const provider = createLLMProvider();

  const output = await provider.generatePlan(input);

  // Post-process: flag low-confidence items for review
  for (const item of output.items) {
    if (item.confidence < 0.5) {
      // Items will be marked reviewRequired by the Governor
    }
  }

  return output;
}
