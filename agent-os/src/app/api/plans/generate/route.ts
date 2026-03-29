import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addDays, startOfDay, endOfDay, format } from "date-fns";
import { generatePlan } from "@/domain/planner";
import { validatePlan } from "@/domain/governor";
import { evaluatePlan } from "@/domain/evaluator";
import { taskRepository } from "@/infra/store/task-repository";
import { calendarRepository } from "@/infra/store/calendar-repository";
import { draftRepository } from "@/infra/store/draft-repository";
import { auditLogger } from "@/infra/audit/audit-logger";
import { createCalendarProvider } from "@/infra/calendar/google-calendar";
import { createSlackNotifier } from "@/infra/slack/slack-notifier";
import { PlannerConstraintsSchema } from "@/domain/types";
import { safeJsonParse } from "@/lib/errors";

const GenerateRequestSchema = z.object({
  targetDate: z.string().optional(),
  constraints: PlannerConstraintsSchema.optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = GenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const tomorrow = addDays(new Date(), 1);
    const targetDate = parsed.data.targetDate || format(tomorrow, "yyyy-MM-dd");
    const targetDateObj = new Date(`${targetDate}T00:00:00`);
    const constraints = parsed.data.constraints || PlannerConstraintsSchema.parse({});

    // 1. Fetch calendar events
    const calendarProvider = createCalendarProvider();
    const externalEvents = await calendarProvider.fetchEvents(
      startOfDay(targetDateObj),
      endOfDay(targetDateObj),
    );

    // Cache events in DB
    await calendarRepository.upsertFromExternal(externalEvents);

    const cachedEvents = await calendarRepository.findByDateRange(
      startOfDay(targetDateObj),
      endOfDay(targetDateObj),
    );

    // 2. Fetch open tasks
    const openTasks = await taskRepository.findOpen();

    // 3. Generate plan via LLM
    const plannerInput = {
      targetDate,
      existingEvents: cachedEvents.map((e) => ({
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        isMeeting: e.isMeeting,
      })),
      openTasks: openTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        deadline: t.deadline ?? null,
        estimatedMinutes: t.estimatedMinutes,
        isCarryOver: t.isCarryOver,
      })),
      constraints,
    };

    const plannerOutput = await generatePlan(plannerInput);

    // 4. Governor validates
    const governorResult = validatePlan(plannerOutput, plannerInput);

    // If STOP, abort and log
    if (governorResult.overallVerdict === "STOP") {
      await auditLogger.log({
        actor: "governor",
        action: "plan_validated",
        resource: "schedule_draft",
        details: { verdict: "STOP", rules: governorResult.rules },
      });

      return NextResponse.json({
        status: "stopped",
        message: "Governor halted plan generation",
        governorResult,
      }, { status: 422 });
    }

    // 5. Evaluate plan quality
    const evaluationResult = evaluatePlan(plannerOutput, plannerInput);

    // 6. Save draft with item-level review flags
    const draft = (await draftRepository.create({
      targetDate: targetDateObj,
      plannerOutput,
      items: plannerOutput.items.map((item, index) => {
        const flags = governorResult.itemFlags?.find((f) => f.itemIndex === index);
        return {
          taskId: item.taskId || undefined,
          title: item.title,
          description: item.description ?? undefined,
          startTime: new Date(item.startTime),
          endTime: new Date(item.endTime),
          blockType: item.blockType,
          reason: item.reason,
          confidence: item.confidence,
          reviewRequired: flags?.reviewRequired ?? false,
          order: index,
        };
      }),
    }))!;

    // Update draft with validation/evaluation results
    const status = governorResult.overallVerdict === "PASS" ? "validated" : "draft";
    const updatedDraft = await draftRepository.updateStatus(draft.id, status === "validated" ? "validated" : "draft", {
      validationResult: JSON.stringify(governorResult),
      evaluationResult: JSON.stringify(evaluationResult),
    }).catch(() => draft);

    // 7. Audit log
    await auditLogger.log({
      actor: "planner",
      action: "plan_generated",
      resource: "schedule_draft",
      resourceId: draft.id,
      draftId: draft.id,
      details: {
        targetDate,
        itemCount: plannerOutput.items.length,
        governorVerdict: governorResult.overallVerdict,
        evaluationScore: evaluationResult.overallScore,
      },
    });

    // 8. Notify Slack
    try {
      const slackNotifier = createSlackNotifier();
      await slackNotifier.postScheduleDraft({
        id: draft.id,
        targetDate,
        items: plannerOutput.items.map((item, idx) => ({
          title: item.title,
          startTime: item.startTime,
          endTime: item.endTime,
          blockType: item.blockType,
          reason: item.reason,
          reviewRequired: governorResult.itemFlags?.[idx]?.reviewRequired ?? false,
        })),
        summary: plannerOutput.summary,
      });

      await auditLogger.log({
        actor: "executor",
        action: "slack_notified",
        resource: "schedule_draft",
        resourceId: draft.id,
        draftId: draft.id,
      });
    } catch (slackError) {
      console.error("Slack notification failed:", slackError);
      // Non-fatal: continue even if Slack fails
    }

    const finalDraft = updatedDraft ?? draft;
    return NextResponse.json({
      draft: {
        ...finalDraft,
        plannerOutput: safeJsonParse(finalDraft.plannerOutput as string),
        validationResult: safeJsonParse(finalDraft.validationResult as string),
        evaluationResult: safeJsonParse(finalDraft.evaluationResult as string),
      },
      governorResult,
      evaluationResult,
    });
  } catch (error) {
    console.error("Plan generation failed:", error);

    await auditLogger.log({
      actor: "system",
      action: "plan_apply_failed",
      resource: "schedule_draft",
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    }).catch(() => {});

    return NextResponse.json(
      { error: "Plan generation failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
