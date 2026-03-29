import { NextRequest, NextResponse } from "next/server";
import { auditLogger } from "@/infra/audit/audit-logger";
import { safeJsonParse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get("draftId") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "100", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const logs = await auditLogger.findAll({ draftId, limit, offset });

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        details: safeJsonParse(log.details as string),
      })),
      total: logs.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Audit log fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 },
    );
  }
}
