import {
  GovernorResult,
  GovernorRuleResult,
  GovernorVerdict,
  PlannerOutput,
  PlannerInput,
} from "@/domain/types";

const CONFIDENCE_THRESHOLD = 0.5;
const MAX_FOCUS_HOURS = 6;

type RuleFunction = (
  output: PlannerOutput,
  input: PlannerInput,
) => GovernorRuleResult;

// Rule: No conflict with existing meetings
const noConflictWithMeetings: RuleFunction = (output, input) => {
  const meetings = input.existingEvents.filter((e) => e.isMeeting);
  const proposedNonMeetings = output.items.filter((i) => i.blockType !== "meeting");

  for (const proposed of proposedNonMeetings) {
    const pStart = new Date(proposed.startTime).getTime();
    const pEnd = new Date(proposed.endTime).getTime();

    for (const meeting of meetings) {
      const mStart = new Date(meeting.startTime).getTime();
      const mEnd = new Date(meeting.endTime).getTime();

      if (pStart < mEnd && pEnd > mStart) {
        return {
          rule: "no_conflict_with_meetings",
          verdict: "FAIL",
          message: `"${proposed.title}" (${proposed.startTime}-${proposed.endTime}) conflicts with meeting "${meeting.title}" (${meeting.startTime}-${meeting.endTime})`,
        };
      }
    }
  }

  return {
    rule: "no_conflict_with_meetings",
    verdict: "PASS",
    message: "No conflicts with existing meetings",
  };
};

// Rule: Max focus hours per day
const maxFocusHoursRule: RuleFunction = (output, input) => {
  const focusItems = output.items.filter((i) => i.blockType === "focus");
  let totalMinutes = 0;

  for (const item of focusItems) {
    const start = new Date(item.startTime).getTime();
    const end = new Date(item.endTime).getTime();
    totalMinutes += (end - start) / (1000 * 60);
  }

  const totalHours = totalMinutes / 60;
  const maxHours = input.constraints.maxFocusHours ?? MAX_FOCUS_HOURS;

  if (totalHours > maxHours) {
    return {
      rule: "max_focus_hours",
      verdict: "FAIL",
      message: `Total focus time ${totalHours.toFixed(1)}h exceeds maximum ${maxHours}h`,
    };
  }

  return {
    rule: "max_focus_hours",
    verdict: "PASS",
    message: `Focus time ${totalHours.toFixed(1)}h within ${maxHours}h limit`,
  };
};

// Rule: Meetings must not be deleted
const meetingsPreservedRule: RuleFunction = (output, input) => {
  const originalMeetings = input.existingEvents.filter((e) => e.isMeeting);
  const outputMeetings = output.items.filter((i) => i.blockType === "meeting");

  for (const original of originalMeetings) {
    const found = outputMeetings.some(
      (m) => m.title === original.title &&
        m.startTime === original.startTime &&
        m.endTime === original.endTime,
    );

    if (!found) {
      return {
        rule: "meetings_preserved",
        verdict: "FAIL",
        message: `Meeting "${original.title}" was removed or modified by planner`,
      };
    }
  }

  return {
    rule: "meetings_preserved",
    verdict: "PASS",
    message: "All existing meetings preserved",
  };
};

// Rule: Insufficient information -> STOP
const sufficientInformationRule: RuleFunction = (output, input) => {
  if (input.openTasks.length === 0 && input.existingEvents.length === 0) {
    return {
      rule: "sufficient_information",
      verdict: "STOP",
      message: "No tasks or events provided - cannot generate meaningful schedule",
    };
  }

  return {
    rule: "sufficient_information",
    verdict: "PASS",
    message: "Sufficient information available",
  };
};

// Rule: Low confidence items -> STOP or flag
const confidenceCheckRule: RuleFunction = (output) => {
  const lowConfidenceItems = output.items.filter(
    (i) => i.confidence < CONFIDENCE_THRESHOLD && i.blockType === "focus",
  );

  if (lowConfidenceItems.length > output.items.length / 2) {
    return {
      rule: "confidence_check",
      verdict: "STOP",
      message: `Too many low-confidence items (${lowConfidenceItems.length}/${output.items.length}). Plan unreliable.`,
    };
  }

  if (lowConfidenceItems.length > 0) {
    return {
      rule: "confidence_check",
      verdict: "PASS",
      message: `${lowConfidenceItems.length} items flagged as review_required due to low confidence`,
      details: lowConfidenceItems.map((i) => i.title),
    };
  }

  return {
    rule: "confidence_check",
    verdict: "PASS",
    message: "All items have acceptable confidence",
  };
};

// Rule: Unknown tasks should be flagged
const unknownTaskRule: RuleFunction = (output, input) => {
  const taskIds = new Set(input.openTasks.map((t) => t.id));
  const unknownItems = output.items.filter(
    (i) => i.taskId && !taskIds.has(i.taskId),
  );

  if (unknownItems.length > 0) {
    return {
      rule: "unknown_task_check",
      verdict: "PASS",
      message: `${unknownItems.length} items reference unknown tasks - flagged for review`,
      details: unknownItems.map((i) => ({ title: i.title, taskId: i.taskId })),
    };
  }

  return {
    rule: "unknown_task_check",
    verdict: "PASS",
    message: "All task references are valid",
  };
};

const ALL_RULES: RuleFunction[] = [
  sufficientInformationRule,
  noConflictWithMeetings,
  maxFocusHoursRule,
  meetingsPreservedRule,
  confidenceCheckRule,
  unknownTaskRule,
];

export function validatePlan(
  output: PlannerOutput,
  input: PlannerInput,
): GovernorResult {
  const ruleResults: GovernorRuleResult[] = [];
  let overallVerdict: GovernorVerdict = "PASS";

  for (const rule of ALL_RULES) {
    const result = rule(output, input);
    ruleResults.push(result);

    // STOP takes highest precedence, then FAIL
    if (result.verdict === "STOP") {
      overallVerdict = "STOP";
    } else if (result.verdict === "FAIL" && overallVerdict !== "STOP") {
      overallVerdict = "FAIL";
    }
  }

  // Build item-level flags
  const taskIds = new Set(input.openTasks.map((t) => t.id));
  const itemFlags = output.items.map((item, index) => {
    const reasons: string[] = [];
    let reviewRequired = false;

    if (item.confidence < CONFIDENCE_THRESHOLD) {
      reviewRequired = true;
      reasons.push("Low confidence score");
    }

    if (item.taskId && !taskIds.has(item.taskId)) {
      reviewRequired = true;
      reasons.push("References unknown task");
    }

    if (item.blockType === "focus" && !item.taskId) {
      reviewRequired = true;
      reasons.push("Focus block without associated task");
    }

    return { itemIndex: index, reviewRequired, reasons };
  });

  return {
    overallVerdict,
    rules: ruleResults,
    itemFlags,
  };
}
