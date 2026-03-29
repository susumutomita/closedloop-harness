import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"), // open, in_progress, done, cancelled
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  deadline: text("deadline"), // ISO string
  estimatedMinutes: integer("estimated_minutes"),
  tags: text("tags"), // JSON array
  isCarryOver: integer("is_carry_over", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const calendarEventCache = sqliteTable("calendar_event_cache", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  externalId: text("external_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time").notNull(), // ISO string
  endTime: text("end_time").notNull(),
  isAllDay: integer("is_all_day", { mode: "boolean" }).notNull().default(false),
  isMeeting: integer("is_meeting", { mode: "boolean" }).notNull().default(false),
  attendees: text("attendees"), // JSON array
  source: text("source").notNull().default("google"),
  fetchedAt: text("fetched_at").notNull().default(sql`(datetime('now'))`),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const scheduleDrafts = sqliteTable("schedule_drafts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  targetDate: text("target_date").notNull(), // YYYY-MM-DD
  status: text("status").notNull().default("draft"), // draft, validated, approved, applied, rejected
  plannerOutput: text("planner_output"), // JSON
  validationResult: text("validation_result"), // JSON
  evaluationResult: text("evaluation_result"), // JSON
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const scheduleDraftItems = sqliteTable("schedule_draft_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  draftId: text("draft_id").notNull().references(() => scheduleDrafts.id),
  taskId: text("task_id").references(() => tasks.id),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  blockType: text("block_type").notNull(), // focus, meeting, break, admin, review
  reason: text("reason"),
  confidence: real("confidence").notNull().default(0.5),
  reviewRequired: integer("review_required", { mode: "boolean" }).notNull().default(false),
  order: integer("order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  draftId: text("draft_id").notNull().references(() => scheduleDrafts.id),
  action: text("action").notNull(), // approve, reject, request_changes
  approver: text("approver").notNull().default("user"),
  comment: text("comment"),
  isDryRun: integer("is_dry_run", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  actor: text("actor").notNull(), // system, user, planner, governor, executor, evaluator
  action: text("action").notNull(),
  resource: text("resource").notNull(), // schedule_draft, calendar_event, task, approval
  resourceId: text("resource_id"),
  draftId: text("draft_id").references(() => scheduleDrafts.id),
  approvalId: text("approval_id").references(() => approvals.id),
  details: text("details"), // JSON
  timestamp: text("timestamp").notNull().default(sql`(datetime('now'))`),
});
