"use client";

import { useState, useEffect } from "react";

interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  resource: string;
  resourceId: string | null;
  draftId: string | null;
  approvalId: string | null;
  details: unknown;
  timestamp: string;
}

const ACTOR_COLORS: Record<string, string> = {
  system: "bg-gray-100 text-gray-700",
  user: "bg-blue-100 text-blue-700",
  planner: "bg-purple-100 text-purple-700",
  governor: "bg-yellow-100 text-yellow-700",
  executor: "bg-green-100 text-green-700",
  evaluator: "bg-orange-100 text-orange-700",
};

const ACTION_LABELS: Record<string, string> = {
  plan_generated: "Plan Generated",
  plan_validated: "Plan Validated",
  plan_evaluation_completed: "Evaluation Completed",
  plan_approved: "Plan Approved",
  plan_rejected: "Plan Rejected",
  plan_changes_requested: "Changes Requested",
  plan_applied: "Plan Applied",
  plan_apply_failed: "Apply Failed",
  plan_dry_run: "Dry Run",
  calendar_synced: "Calendar Synced",
  slack_notified: "Slack Notified",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit")
      .then((res) => res.json())
      .then((data) => setLogs(data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading audit logs...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Audit Log</h2>
      <p className="text-sm text-gray-500">
        Complete history of all operations: who proposed, approved, and applied changes.
      </p>

      {logs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No audit log entries yet.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                    {new Date(log.timestamp).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${ACTOR_COLORS[log.actor] || "bg-gray-100"}`}>
                      {log.actor}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {ACTION_LABELS[log.action] || log.action}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {log.resource}
                    {log.draftId && (
                      <a href={`/drafts/${log.draftId}`} className="ml-1 text-blue-600 hover:underline text-xs">
                        (view)
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
