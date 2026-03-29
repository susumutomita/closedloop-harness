import {
  EvaluationResult,
  EvaluationItemResult,
  PlannerOutput,
  PlannerInput,
} from "@/domain/types";

type EvaluationFunction = (
  output: PlannerOutput,
  input: PlannerInput,
) => EvaluationItemResult;

// Criterion: No scheduling conflicts
const evaluateNoConflict: EvaluationFunction = (output) => {
  const items = output.items;
  let conflicts = 0;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const aStart = new Date(items[i].startTime).getTime();
      const aEnd = new Date(items[i].endTime).getTime();
      const bStart = new Date(items[j].startTime).getTime();
      const bEnd = new Date(items[j].endTime).getTime();

      if (aStart < bEnd && aEnd > bStart) {
        conflicts++;
      }
    }
  }

  const score = conflicts === 0 ? 1.0 : Math.max(0, 1 - conflicts * 0.3);

  return {
    criterion: "no_conflict",
    passed: conflicts === 0,
    score,
    message: conflicts === 0
      ? "No scheduling conflicts detected"
      : `${conflicts} scheduling conflict(s) detected`,
  };
};

// Criterion: Time feasibility
const evaluateTimeFeasible: EvaluationFunction = (output, input) => {
  const workStart = parseTimeToMinutes(input.constraints.workDayStart);
  const workEnd = parseTimeToMinutes(input.constraints.workDayEnd);
  let violations = 0;

  for (const item of output.items) {
    const start = new Date(item.startTime);
    const end = new Date(item.endTime);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();

    if (startMinutes < workStart || endMinutes > workEnd) {
      violations++;
    }

    if (end.getTime() <= start.getTime()) {
      violations++;
    }
  }

  const score = violations === 0 ? 1.0 : Math.max(0, 1 - violations * 0.25);

  return {
    criterion: "time_feasible",
    passed: violations === 0,
    score,
    message: violations === 0
      ? "All blocks within work hours"
      : `${violations} block(s) outside work hours or invalid`,
  };
};

// Criterion: Deadline priority ordering
const evaluateDeadlinePriority: EvaluationFunction = (output, input) => {
  const tasksWithDeadlines = input.openTasks
    .filter((t) => t.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  if (tasksWithDeadlines.length === 0) {
    return {
      criterion: "deadline_priority",
      passed: true,
      score: 1.0,
      message: "No deadline-bound tasks to evaluate",
    };
  }

  // Check if urgent tasks are scheduled earlier
  const scheduledTaskOrder = output.items
    .filter((i) => i.taskId)
    .map((i) => i.taskId);

  let correctOrder = 0;
  for (let i = 0; i < tasksWithDeadlines.length; i++) {
    const idx = scheduledTaskOrder.indexOf(tasksWithDeadlines[i].id);
    if (idx !== -1) correctOrder++;
  }

  const score = tasksWithDeadlines.length > 0
    ? correctOrder / tasksWithDeadlines.length
    : 1.0;

  return {
    criterion: "deadline_priority",
    passed: score >= 0.5,
    score,
    message: `${correctOrder}/${tasksWithDeadlines.length} deadline tasks scheduled`,
  };
};

// Criterion: Each block has an explainable reason
const evaluateExplainableReason: EvaluationFunction = (output) => {
  let withReason = 0;

  for (const item of output.items) {
    if (item.reason && item.reason.trim().length > 5) {
      withReason++;
    }
  }

  const score = output.items.length > 0
    ? withReason / output.items.length
    : 1.0;

  return {
    criterion: "explainable_reason",
    passed: score >= 0.8,
    score,
    message: `${withReason}/${output.items.length} blocks have meaningful reasons`,
  };
};

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

const ALL_CRITERIA: EvaluationFunction[] = [
  evaluateNoConflict,
  evaluateTimeFeasible,
  evaluateDeadlinePriority,
  evaluateExplainableReason,
];

export function evaluatePlan(
  output: PlannerOutput,
  input: PlannerInput,
): EvaluationResult {
  const criteria: EvaluationItemResult[] = ALL_CRITERIA.map((fn) => fn(output, input));

  const overallScore =
    criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length;
  const passed = criteria.every((c) => c.passed);

  return {
    overallScore,
    passed,
    criteria,
  };
}
