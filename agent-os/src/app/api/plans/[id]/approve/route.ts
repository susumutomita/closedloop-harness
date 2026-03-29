import { NextRequest, NextResponse } from "next/server";
import { CreateApprovalSchema } from "@/domain/types";
import { draftRepository } from "@/infra/store/draft-repository";
import { approvalRepository } from "@/infra/store/approval-repository";
import { auditLogger } from "@/infra/audit/audit-logger";
import { safeJsonParse } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = CreateApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid approval input", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const draft = await draftRepository.findById(id);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    // Check reviewRequired items
    const reviewItems = draft.items.filter((i) => i.reviewRequired);
    if (parsed.data.action === "approve" && reviewItems.length > 0 && !parsed.data.comment) {
      return NextResponse.json({
        error: "Approval requires comment when review_required items exist",
        reviewRequiredItems: reviewItems.map((i) => ({
          title: i.title,
          reason: i.reason,
        })),
      }, { status: 400 });
    }

    // Create approval record
    const approval = await approvalRepository.create(id, parsed.data);

    // Update draft status based on action
    let newStatus: string;
    let auditAction: string;

    switch (parsed.data.action) {
      case "approve":
        newStatus = "approved";
        auditAction = "plan_approved";
        break;
      case "reject":
        newStatus = "rejected";
        auditAction = "plan_rejected";
        break;
      case "request_changes":
        newStatus = "draft";
        auditAction = "plan_changes_requested";
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updatedDraft = await draftRepository.updateStatus(id, newStatus);

    await auditLogger.log({
      actor: "user",
      action: auditAction as "plan_approved" | "plan_rejected" | "plan_changes_requested",
      resource: "approval",
      resourceId: approval.id,
      draftId: id,
      approvalId: approval.id,
      details: {
        action: parsed.data.action,
        comment: parsed.data.comment,
        isDryRun: parsed.data.isDryRun,
      },
    });

    return NextResponse.json({
      approval,
      draft: updatedDraft ? {
        ...updatedDraft,
        plannerOutput: safeJsonParse(updatedDraft.plannerOutput as string),
        validationResult: safeJsonParse(updatedDraft.validationResult as string),
        evaluationResult: safeJsonParse(updatedDraft.evaluationResult as string),
      } : null,
    });
  } catch (error) {
    console.error("Approval failed:", error);
    return NextResponse.json(
      { error: "Approval failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
