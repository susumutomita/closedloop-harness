import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "agent-os.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'medium',
    deadline TEXT,
    estimated_minutes INTEGER,
    tags TEXT,
    is_carry_over INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calendar_event_cache (
    id TEXT PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    is_meeting INTEGER NOT NULL DEFAULT 0,
    attendees TEXT,
    source TEXT NOT NULL DEFAULT 'google',
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedule_drafts (
    id TEXT PRIMARY KEY,
    target_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    planner_output TEXT,
    validation_result TEXT,
    evaluation_result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedule_draft_items (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL REFERENCES schedule_drafts(id),
    task_id TEXT REFERENCES tasks(id),
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    block_type TEXT NOT NULL,
    reason TEXT,
    confidence REAL NOT NULL DEFAULT 0.5,
    review_required INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL REFERENCES schedule_drafts(id),
    action TEXT NOT NULL,
    approver TEXT NOT NULL DEFAULT 'user',
    comment TEXT,
    is_dry_run INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    draft_id TEXT REFERENCES schedule_drafts(id),
    approval_id TEXT REFERENCES approvals(id),
    details TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log("Database migrated successfully at:", dbPath);
sqlite.close();
