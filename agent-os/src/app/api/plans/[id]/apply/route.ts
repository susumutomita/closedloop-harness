import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { draftRepository } from "@/infra/store/draft-repository";
import { auditLogger } from "@/infra/audit/audit-logger";
import { createCalendarProvider } from "@/infra/calendar/google-calendar";
import { safeJsonParse } from "@/lib/errors";

const ApplyRequestSchema = z.object({
  dryRun: z.boolean().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = ApplyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { dryRun } = parsed.data;

    const draft = await draftRepository.findById(id);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    // SAFETY: Only approved drafts can be applied
    if (draft.status !== "approved") {
      return NextResponse.json(
        { error: `Cannot apply draft with status "${draft.status}". Must be approved first.` },
        { status: 409 },
      );
    }

    // SAFETY: Check for review_required items that haven't been addressed
    const unreviewedItems = draft.items.filter((i) => i.reviewRequired);
    if (unreviewedItems.length > 0) {
      const latestApproval = draft.approvals[0];
      if (!latestApproval?.comment) {
        return NextResponse.json({
          error: "Cannot apply: unreviewed items exist without approval comment",
          unreviewedItems: unreviewedItems.map((i) => i.title),
        }, { status: 409 });
      }
    }

    if (dryRun) {
      // Dry run: just show what would happen
      await auditLogger.log({
        actor: "executor",
        action: "plan_dry_run",
        resource: "schedule_draft",
        resourceId: id,
        draftId: id,
        details: {
          itemCount: draft.items.length,
          wouldCreate: draft.items
            .filter((i) => i.blockType !== "meeting")
            .map((i) => ({
              title: i.title,
              startTime: i.startTime,
              endTime: i.endTime,
            })),
        },
      });

      return NextResponse.json({
        dryRun: true,
        message: "Dry run completed. No changes applied.",
        wouldCreate: draft.items
          .filter((i) => i.blockType !== "meeting")
          .map((i) => ({
            title: i.title,
            startTime: i.startTime,
            endTime: i.endTime,
            blockType: i.blockType,
          })),
        existingMeetingsPreserved: draft.items
          .filter((i) => i.blockType === "meeting")
          .map((i) => i.title),
      });
    }

    // REAL APPLY: Create calendar events
    const calendarProvider = createCalendarProvider();
    const results: Array<{ title: string; externalId: string; status: string }> = [];
    const errors: Array<{ title: string; error: string }> = [];

    // Only create non-meeting blocks (meetings already exist)
    const itemsToCreate = draft.items.filter((i) => i.blockType !== "meeting");

    for (const item of itemsToCreate) {
      try {
        const result = await calendarProvider.createEvent({
          title: item.title,
          description: item.description || `Scheduled by Agent OS: ${item.reason}`,
          startTime: item.startTime,
          endTime: item.endTime,
        });
        results.push({ title: item.title, externalId: result.externalId, status: "created" });
      } catch (err) {
        errors.push({
          title: item.title,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Only mark as applied if no errors
    if (errors.length === 0) {
      await draftRepository.updateStatus(id, "applied");

      await auditLogger.log({
        actor: "executor",
        action: "plan_applied",
        resource: "schedule_draft",
        resourceId: id,
        draftId: id,
        details: { createdEvents: results.length },
      });

      return NextResponse.json({
        dryRun: false,
        message: `Successfully applied ${results.length} calendar events`,
        results,
      });
    } else {
      // Partial failure: don't change status, log failure
      await auditLogger.log({
        actor: "executor",
        action: "plan_apply_failed",
        resource: "schedule_draft",
        resourceId: id,
        draftId: id,
        details: { successes: results.length, failures: errors.length, errors },
      });

      return NextResponse.json({
        dryRun: false,
        message: `Partial failure: ${results.length} succeeded, ${errors.length} failed`,
        results,
        errors,
      }, { status: 207 });
    }
  } catch (error) {
    console.error("Apply failed:", error);

    await auditLogger.log({
      actor: "executor",
      action: "plan_apply_failed",
      resource: "schedule_draft",
      details: { error: error instanceof Error ? error.message : "Unknown" },
    }).catch(() => {});

    return NextResponse.json(
      { error: "Apply failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
