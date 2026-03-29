import { PlannerInput, PlannerOutput, PlannerOutputSchema } from "@/domain/types";

export interface LLMProvider {
  generatePlan(input: PlannerInput): Promise<PlannerOutput>;
}

export function createLLMProvider(): LLMProvider {
  const providerType = process.env.LLM_PROVIDER || "mock";

  switch (providerType) {
    case "anthropic":
      return createAnthropicProvider();
    case "openai":
      return createOpenAIProvider();
    case "mock":
    default:
      return createMockProvider();
  }
}

function createMockProvider(): LLMProvider {
  return {
    async generatePlan(input: PlannerInput): Promise<PlannerOutput> {
      const items: PlannerOutput["items"] = [];
      const targetDate = input.targetDate;
      let currentHour = 9;

      // Place existing meetings first (they are immutable)
      for (const event of input.existingEvents) {
        if (event.isMeeting) {
          items.push({
            taskId: null,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            blockType: "meeting",
            reason: "Existing meeting - preserved as-is",
            confidence: 1.0,
          });
        }
      }

      // Add lunch break
      items.push({
        taskId: null,
        title: "Lunch Break",
        startTime: `${targetDate}T12:00:00`,
        endTime: `${targetDate}T13:00:00`,
        blockType: "break",
        reason: "Scheduled lunch break",
        confidence: 1.0,
      });

      // Schedule tasks in priority order, fitting around meetings
      const sortedTasks = [...input.openTasks].sort((a, b) => {
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      });

      let focusHoursUsed = 0;
      for (const task of sortedTasks) {
        if (focusHoursUsed >= input.constraints.maxFocusHours) break;

        const duration = task.estimatedMinutes ?? 60;

        // Find next available slot (skip lunch 12-13, skip existing events)
        while (currentHour === 12) currentHour = 13;
        if (currentHour >= 18) break;

        const startTime = `${targetDate}T${String(currentHour).padStart(2, "0")}:00:00`;
        const endMinutes = currentHour * 60 + duration;
        const endHour = Math.floor(endMinutes / 60);
        const endMin = endMinutes % 60;
        const endTime = `${targetDate}T${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}:00`;

        const confidence = task.isCarryOver ? 0.6 : 0.8;

        items.push({
          taskId: task.id,
          title: task.title,
          description: task.description,
          startTime,
          endTime,
          blockType: "focus",
          reason: task.isCarryOver
            ? `Carry-over task with ${task.priority} priority - needs attention`
            : `${task.priority} priority task${task.deadline ? ` with deadline ${task.deadline}` : ""}`,
          confidence,
        });

        currentHour = endHour + (endMin > 0 ? 1 : 0);
        focusHoursUsed += duration / 60;
      }

      // Add end-of-day review
      if (currentHour < 18) {
        items.push({
          taskId: null,
          title: "End of Day Review",
          startTime: `${targetDate}T17:00:00`,
          endTime: `${targetDate}T17:30:00`,
          blockType: "admin",
          reason: "Daily review and planning for next day",
          confidence: 0.9,
        });
      }

      const result: PlannerOutput = {
        items,
        summary: `Generated schedule for ${targetDate} with ${items.length} blocks, including ${sortedTasks.length} tasks prioritized by urgency.`,
        warnings: focusHoursUsed >= input.constraints.maxFocusHours
          ? ["Maximum focus hours reached. Some tasks were not scheduled."]
          : undefined,
      };

      return PlannerOutputSchema.parse(result);
    },
  };
}

function createAnthropicProvider(): LLMProvider {
  return {
    async generatePlan(input: PlannerInput): Promise<PlannerOutput> {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic();

      const systemPrompt = `You are a work schedule planner. Given calendar events and tasks, create an optimal schedule for the day.
Rules:
- Never move or delete existing meetings
- Maximum ${input.constraints.maxFocusHours} hours of focus work
- Include lunch break from ${input.constraints.lunchStart} to ${input.constraints.lunchEnd}
- Work hours: ${input.constraints.workDayStart} to ${input.constraints.workDayEnd}
- Prioritize by: critical > high > medium > low
- Carry-over tasks get slightly higher priority
- If unsure about a task, set confidence low and reviewRequired true

Respond ONLY with valid JSON matching this schema:
{
  "items": [{ "taskId": string|null, "title": string, "description": string|null, "startTime": "YYYY-MM-DDTHH:mm:ss", "endTime": "YYYY-MM-DDTHH:mm:ss", "blockType": "focus"|"meeting"|"break"|"admin"|"review", "reason": string, "confidence": number(0-1) }],
  "summary": string,
  "warnings": string[]
}`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: JSON.stringify(input) }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = JSON.parse(text);
      return PlannerOutputSchema.parse(parsed);
    },
  };
}

function createOpenAIProvider(): LLMProvider {
  return {
    async generatePlan(input: PlannerInput): Promise<PlannerOutput> {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI();

      const systemPrompt = `You are a work schedule planner. Given calendar events and tasks, create an optimal schedule.
Rules:
- Never move/delete existing meetings
- Max ${input.constraints.maxFocusHours}h focus work
- Lunch: ${input.constraints.lunchStart}-${input.constraints.lunchEnd}
- Hours: ${input.constraints.workDayStart}-${input.constraints.workDayEnd}
- Priority: critical > high > medium > low
- Low confidence = reviewRequired true

Respond ONLY with valid JSON:
{"items":[{"taskId":string|null,"title":string,"description":string|null,"startTime":"YYYY-MM-DDTHH:mm:ss","endTime":"YYYY-MM-DDTHH:mm:ss","blockType":"focus"|"meeting"|"break"|"admin"|"review","reason":string,"confidence":number}],"summary":string,"warnings":string[]}`;

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_object" },
      });

      const text = response.choices[0].message.content || "{}";
      const parsed = JSON.parse(text);
      return PlannerOutputSchema.parse(parsed);
    },
  };
}
