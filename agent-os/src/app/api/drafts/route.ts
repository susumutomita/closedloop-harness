import { NextResponse } from "next/server";
import { draftRepository } from "@/infra/store/draft-repository";
import { safeJsonParse } from "@/lib/errors";

export async function GET() {
  try {
    const drafts = await draftRepository.findAll();
    return NextResponse.json({
      drafts: drafts.map((d) => ({
        ...d,
        plannerOutput: safeJsonParse(d.plannerOutput as string),
        validationResult: safeJsonParse(d.validationResult as string),
        evaluationResult: safeJsonParse(d.evaluationResult as string),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch drafts" }, { status: 500 });
  }
}
