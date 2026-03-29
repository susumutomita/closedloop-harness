"use client";

import { useState, useEffect, useCallback } from "react";

interface DraftItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  blockType: string;
  reason: string | null;
  confidence: number;
  reviewRequired: boolean;
  task: { id: string; title: string; priority: string } | null;
}

interface Draft {
  id: string;
  targetDate: string;
  status: string;
  items: DraftItem[];
  evaluationResult: { overallScore: number; criteria: Array<{ criterion: string; passed: boolean; score: number }> } | null;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  deadline: string | null;
  isCarryOver: boolean;
}

const BLOCK_COLORS: Record<string, string> = {
  focus: "bg-blue-100 border-blue-300 text-blue-800",
  meeting: "bg-purple-100 border-purple-300 text-purple-800",
  break: "bg-green-100 border-green-300 text-green-800",
  admin: "bg-yellow-100 border-yellow-300 text-yellow-800",
  review: "bg-orange-100 border-orange-300 text-orange-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-gray-100 text-gray-800",
};

export default function DashboardPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [draftsRes, tasksRes] = await Promise.all([
        fetch("/api/drafts"),
        fetch("/api/tasks"),
      ]);
      const draftsData = await draftsRes.json();
      const tasksData = await tasksRes.json();
      setDrafts(draftsData.drafts || []);
      setTasks(tasksData.tasks || []);
    } catch {
      setError("Failed to load data");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Generation failed");
      }
      await fetchData();
    } catch {
      setError("Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  };

  const latestDraft = drafts[0];
  const reviewRequiredItems = latestDraft?.items.filter((i) => i.reviewRequired) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Tomorrow&apos;s schedule planning</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {generating ? "Generating..." : "Generate Tomorrow's Plan"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Review Required Section */}
      {reviewRequiredItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 mb-2">
            Review Required ({reviewRequiredItems.length} items)
          </h3>
          <ul className="space-y-2">
            {reviewRequiredItems.map((item) => (
              <li key={item.id} className="text-sm text-amber-700 flex items-start gap-2">
                <span className="mt-0.5">!</span>
                <div>
                  <span className="font-medium">{item.title}</span>
                  <span className="text-amber-600 ml-2">
                    (confidence: {(item.confidence * 100).toFixed(0)}%)
                  </span>
                  {item.reason && <p className="text-amber-600 text-xs mt-0.5">{item.reason}</p>}
                </div>
              </li>
            ))}
          </ul>
          {latestDraft && (
            <a
              href={`/drafts/${latestDraft.id}`}
              className="inline-block mt-3 text-sm font-medium text-amber-800 underline"
            >
              Review Draft
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Draft */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Latest Schedule Draft</h3>
            {latestDraft && (
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  latestDraft.status === "approved" ? "bg-green-100 text-green-800" :
                  latestDraft.status === "validated" ? "bg-blue-100 text-blue-800" :
                  latestDraft.status === "applied" ? "bg-emerald-100 text-emerald-800" :
                  latestDraft.status === "rejected" ? "bg-red-100 text-red-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {latestDraft.status}
                </span>
                <a href={`/drafts/${latestDraft.id}`} className="text-sm text-blue-600 hover:underline">
                  Details
                </a>
              </div>
            )}
          </div>

          {!latestDraft ? (
            <p className="text-gray-400 text-sm">No drafts yet. Generate a plan to get started.</p>
          ) : (
            <div className="space-y-2">
              {latestDraft.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    BLOCK_COLORS[item.blockType] || "bg-gray-50 border-gray-200"
                  } ${item.reviewRequired ? "ring-2 ring-amber-300" : ""}`}
                >
                  <div className="text-xs font-mono whitespace-nowrap pt-0.5">
                    {formatTime(item.startTime)}
                    <br />
                    {formatTime(item.endTime)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.title}</span>
                      <span className="text-xs opacity-60">{item.blockType}</span>
                      {item.reviewRequired && (
                        <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                          review
                        </span>
                      )}
                    </div>
                    {item.reason && (
                      <p className="text-xs opacity-70 mt-0.5">{item.reason}</p>
                    )}
                  </div>
                  <div className="text-xs opacity-50">
                    {(item.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {latestDraft?.evaluationResult && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Evaluation</h4>
              <div className="flex gap-3">
                {latestDraft.evaluationResult.criteria.map((c) => (
                  <div key={c.criterion} className="text-xs">
                    <span className={c.passed ? "text-green-600" : "text-red-600"}>
                      {c.passed ? "OK" : "NG"}
                    </span>{" "}
                    <span className="text-gray-500">{c.criterion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tasks Sidebar */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-lg mb-4">Open Tasks</h3>
          {tasks.length === 0 ? (
            <p className="text-gray-400 text-sm">No open tasks</p>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li key={task.id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority}
                    </span>
                    <div>
                      <span className="font-medium">{task.title}</span>
                      {task.isCarryOver && (
                        <span className="ml-1 text-xs text-orange-600">(carry-over)</span>
                      )}
                      {task.deadline && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Due: {new Date(task.deadline).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* All Drafts */}
      {drafts.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-lg mb-4">Draft History</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Items</th>
                <th className="pb-2 font-medium">Created</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id} className="border-b border-gray-50">
                  <td className="py-2">{new Date(d.targetDate).toLocaleDateString()}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      d.status === "approved" ? "bg-green-100 text-green-800" :
                      d.status === "applied" ? "bg-emerald-100 text-emerald-800" :
                      d.status === "rejected" ? "bg-red-100 text-red-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>{d.status}</span>
                  </td>
                  <td className="py-2">{d.items.length}</td>
                  <td className="py-2 text-gray-400">{new Date(d.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <a href={`/drafts/${d.id}`} className="text-blue-600 hover:underline">View</a>
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

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
