import { NextRequest, NextResponse } from "next/server";
import { validatePlan } from "@/domain/governor";
import { evaluatePlan } from "@/domain/evaluator";
import { draftRepository } from "@/infra/store/draft-repository";
import { auditLogger } from "@/infra/audit/audit-logger";
import { safeJsonParse } from "@/lib/errors";
import { PlannerInputSchema, PlannerOutputSchema } from "@/domain/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const draft = await draftRepository.findById(id);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const plannerOutput = safeJsonParse(draft.plannerOutput as string);
    if (!plannerOutput) {
      return NextResponse.json({ error: "No planner output found" }, { status: 400 });
    }

    const parsedOutput = PlannerOutputSchema.safeParse(plannerOutput);
    if (!parsedOutput.success) {
      return NextResponse.json(
        { error: "Invalid planner output stored", details: parsedOutput.error.format() },
        { status: 400 },
      );
    }

    // Reconstruct planner input from draft data
    const plannerInput = {
      targetDate: draft.targetDate,
      existingEvents: draft.items
        .filter((i) => i.blockType === "meeting")
        .map((i) => ({
          title: i.title,
          startTime: i.startTime,
          endTime: i.endTime,
          isMeeting: true,
        })),
      openTasks: draft.items
        .filter((i) => i.task)
        .map((i) => ({
          id: i.task!.id,
          title: i.task!.title,
          description: i.task!.description,
          priority: i.task!.priority,
          deadline: i.task!.deadline ?? null,
          estimatedMinutes: i.task!.estimatedMinutes,
          isCarryOver: i.task!.isCarryOver,
        })),
      constraints: {
        workDayStart: "09:00",
        workDayEnd: "18:00",
        maxFocusHours: 6,
        minBreakMinutes: 15,
        lunchStart: "12:00",
        lunchEnd: "13:00",
      },
    };

    const governorResult = validatePlan(parsedOutput.data, plannerInput);
    const evaluationResult = evaluatePlan(parsedOutput.data, plannerInput);

    const newStatus = governorResult.overallVerdict === "PASS" ? "validated" : "draft";

    if (draft.status === "draft" && newStatus === "validated") {
      await draftRepository.updateStatus(id, "validated", {
        validationResult: JSON.stringify(governorResult),
        evaluationResult: JSON.stringify(evaluationResult),
      });
    }

    await auditLogger.log({
      actor: "governor",
      action: "plan_validated",
      resource: "schedule_draft",
      resourceId: id,
      draftId: id,
      details: {
        verdict: governorResult.overallVerdict,
        evaluationScore: evaluationResult.overallScore,
      },
    });

    return NextResponse.json({
      governorResult,
      evaluationResult,
      draftStatus: newStatus,
    });
  } catch (error) {
    console.error("Validation failed:", error);
    return NextResponse.json(
      { error: "Validation failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
