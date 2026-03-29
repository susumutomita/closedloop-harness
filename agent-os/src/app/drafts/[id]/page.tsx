"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface DraftItem {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  blockType: string;
  reason: string | null;
  confidence: number;
  reviewRequired: boolean;
  task: { id: string; title: string; priority: string } | null;
}

interface ApprovalRecord {
  id: string;
  action: string;
  approver: string;
  comment: string | null;
  isDryRun: boolean;
  createdAt: string;
}

interface Draft {
  id: string;
  targetDate: string;
  status: string;
  items: DraftItem[];
  approvals: ApprovalRecord[];
  validationResult: {
    overallVerdict: string;
    rules: Array<{ rule: string; verdict: string; message: string }>;
  } | null;
  evaluationResult: {
    overallScore: number;
    passed: boolean;
    criteria: Array<{ criterion: string; passed: boolean; score: number; message: string }>;
  } | null;
}

const BLOCK_COLORS: Record<string, string> = {
  focus: "bg-blue-50 border-blue-200",
  meeting: "bg-purple-50 border-purple-200",
  break: "bg-green-50 border-green-200",
  admin: "bg-yellow-50 border-yellow-200",
  review: "bg-orange-50 border-orange-200",
};

export default function DraftReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchDraft = useCallback(async () => {
    try {
      const res = await fetch("/api/drafts");
      const data = await res.json();
      const found = data.drafts?.find((d: Draft) => d.id === id);
      setDraft(found || null);
    } catch {
      setError("Failed to load draft");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDraft(); }, [fetchDraft]);

  const handleApproval = async (action: "approve" | "reject" | "request_changes") => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/plans/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed");
      } else {
        setSuccessMsg(`Draft ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "sent back for changes"}`);
        setComment("");
        await fetchDraft();
      }
    } catch {
      setError("Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApply = async (dryRun: boolean) => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/plans/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Apply failed");
      } else {
        setSuccessMsg(data.message);
        await fetchDraft();
      }
    } catch {
      setError("Apply failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidate = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${id}/validate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Validation failed");
      } else {
        setSuccessMsg(`Validation: ${data.governorResult.overallVerdict}`);
        await fetchDraft();
      }
    } catch {
      setError("Validation failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="text-gray-400">Loading...</div>;
  if (!draft) return <div className="text-red-600">Draft not found</div>;

  const canApprove = draft.status === "validated";
  const canApply = draft.status === "approved";
  const canValidate = draft.status === "draft";
  const hasReviewItems = draft.items.some((i) => i.reviewRequired);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Dashboard
        </button>
        <h2 className="text-2xl font-bold">Draft Review</h2>
        <span className={`text-xs px-2 py-1 rounded-full ${
          draft.status === "approved" ? "bg-green-100 text-green-800" :
          draft.status === "validated" ? "bg-blue-100 text-blue-800" :
          draft.status === "applied" ? "bg-emerald-100 text-emerald-800" :
          draft.status === "rejected" ? "bg-red-100 text-red-800" :
          "bg-gray-100 text-gray-800"
        }`}>{draft.status}</span>
      </div>

      <p className="text-sm text-gray-500">
        Target: {new Date(draft.targetDate).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
      </p>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>}
      {successMsg && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{successMsg}</div>}

      {/* Schedule Blocks */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold mb-4">Schedule Blocks</h3>
        <div className="space-y-3">
          {draft.items.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-lg border ${BLOCK_COLORS[item.blockType] || "bg-gray-50 border-gray-200"} ${
                item.reviewRequired ? "ring-2 ring-amber-300" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-gray-600">
                      {formatTime(item.startTime)} - {formatTime(item.endTime)}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white bg-opacity-50">
                      {item.blockType}
                    </span>
                    {item.reviewRequired && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-medium">
                        REVIEW REQUIRED
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium">{item.title}</h4>
                  {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}
                  {item.reason && (
                    <p className="text-sm text-gray-500 mt-1 italic">Reason: {item.reason}</p>
                  )}
                  {item.task && (
                    <p className="text-xs text-gray-400 mt-1">
                      Task: {item.task.title} ({item.task.priority})
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    item.confidence >= 0.8 ? "text-green-600" :
                    item.confidence >= 0.5 ? "text-yellow-600" :
                    "text-red-600"
                  }`}>
                    {(item.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-400">confidence</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Validation Results */}
      {draft.validationResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold mb-3">
            Governor Validation:{" "}
            <span className={
              draft.validationResult.overallVerdict === "PASS" ? "text-green-600" :
              draft.validationResult.overallVerdict === "STOP" ? "text-red-600" :
              "text-yellow-600"
            }>{draft.validationResult.overallVerdict}</span>
          </h3>
          <div className="space-y-2">
            {draft.validationResult.rules.map((rule, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className={
                  rule.verdict === "PASS" ? "text-green-500" :
                  rule.verdict === "STOP" ? "text-red-500" :
                  "text-yellow-500"
                }>
                  {rule.verdict === "PASS" ? "OK" : rule.verdict === "STOP" ? "STOP" : "NG"}
                </span>
                <span className="text-gray-600">{rule.rule}</span>
                <span className="text-gray-400">- {rule.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation Results */}
      {draft.evaluationResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold mb-3">
            Evaluation Score:{" "}
            <span className={draft.evaluationResult.passed ? "text-green-600" : "text-yellow-600"}>
              {(draft.evaluationResult.overallScore * 100).toFixed(0)}%
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {draft.evaluationResult.criteria.map((c, idx) => (
              <div key={idx} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className={c.passed ? "text-green-500" : "text-red-500"}>
                    {c.passed ? "OK" : "NG"}
                  </span>
                  <span className="font-medium">{c.criterion}</span>
                  <span className="text-gray-400">{(c.score * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-gray-400 ml-6">{c.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold mb-4">Actions</h3>

        {hasReviewItems && canApprove && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mb-4">
            This draft has items flagged for review. A comment is required for approval.
          </div>
        )}

        <div className="space-y-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment (required if review items exist)..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />

          <div className="flex gap-3">
            {canValidate && (
              <button
                onClick={handleValidate}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Validate
              </button>
            )}
            {canApprove && (
              <>
                <button
                  onClick={() => handleApproval("approve")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleApproval("reject")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApproval("request_changes")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 disabled:opacity-50"
                >
                  Request Changes
                </button>
              </>
            )}
            {canApply && (
              <>
                <button
                  onClick={() => handleApply(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50"
                >
                  Dry Run
                </button>
                <button
                  onClick={() => handleApply(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  Apply to Calendar
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Approval History */}
      {draft.approvals.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold mb-3">Approval History</h3>
          <div className="space-y-2">
            {draft.approvals.map((a) => (
              <div key={a.id} className="text-sm flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  a.action === "approve" ? "bg-green-100 text-green-800" :
                  a.action === "reject" ? "bg-red-100 text-red-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>{a.action}</span>
                <span className="text-gray-600">{a.approver}</span>
                {a.isDryRun && <span className="text-xs text-gray-400">(dry-run)</span>}
                {a.comment && <span className="text-gray-500">- {a.comment}</span>}
                <span className="text-gray-400 text-xs ml-auto">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
