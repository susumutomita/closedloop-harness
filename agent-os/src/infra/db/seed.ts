import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { tasks, calendarEventCache } from "./schema";
import { addDays, format, setHours, setMinutes } from "date-fns";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "agent-os.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
const db = drizzle(sqlite);

async function main() {
  console.log("Seeding database...");

  // Clear
  db.delete(calendarEventCache).run();
  db.delete(tasks).run();

  const tomorrow = addDays(new Date(), 1);
  const dateStr = format(tomorrow, "yyyy-MM-dd");
  const now = new Date().toISOString();

  // Create tasks
  const taskData = [
    {
      id: crypto.randomUUID(),
      title: "API認証機能のリファクタリング",
      description: "OAuth2フローの改善とトークンリフレッシュの実装",
      status: "open",
      priority: "high",
      deadline: addDays(new Date(), 3).toISOString(),
      estimatedMinutes: 120,
      tags: JSON.stringify(["backend", "auth"]),
      isCarryOver: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: "ダッシュボードUIの修正",
      description: "チャートコンポーネントのレスポンシブ対応",
      status: "open",
      priority: "medium",
      estimatedMinutes: 90,
      tags: JSON.stringify(["frontend", "ui"]),
      isCarryOver: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: "本番環境のログ監視設定",
      description: "Datadogアラートのしきい値を調整",
      status: "open",
      priority: "critical",
      deadline: addDays(new Date(), 1).toISOString(),
      estimatedMinutes: 60,
      tags: JSON.stringify(["ops", "monitoring"]),
      isCarryOver: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: "新機能のテスト設計書作成",
      description: "決済機能のE2Eテストシナリオ",
      status: "open",
      priority: "medium",
      estimatedMinutes: 90,
      tags: JSON.stringify(["qa", "docs"]),
      isCarryOver: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      title: "チームミーティング資料準備",
      description: "週次進捗レポートとデモ準備",
      status: "open",
      priority: "low",
      estimatedMinutes: 30,
      tags: JSON.stringify(["admin"]),
      isCarryOver: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const task of taskData) {
    db.insert(tasks).values(task).run();
  }

  // Calendar events
  const calendarData = [
    {
      id: crypto.randomUUID(),
      externalId: `mock-standup-${dateStr}`,
      title: "Daily Standup",
      startTime: setMinutes(setHours(tomorrow, 9), 30).toISOString(),
      endTime: setMinutes(setHours(tomorrow, 9), 45).toISOString(),
      isMeeting: true,
      isAllDay: false,
      attendees: JSON.stringify(["team@example.com"]),
      source: "google",
      fetchedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      externalId: `mock-1on1-${dateStr}`,
      title: "1:1 with Manager",
      startTime: setHours(tomorrow, 14).toISOString(),
      endTime: setMinutes(setHours(tomorrow, 14), 30).toISOString(),
      isMeeting: true,
      isAllDay: false,
      attendees: JSON.stringify(["manager@example.com"]),
      source: "google",
      fetchedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      externalId: `mock-review-${dateStr}`,
      title: "Sprint Review",
      startTime: setHours(tomorrow, 16).toISOString(),
      endTime: setHours(tomorrow, 17).toISOString(),
      isMeeting: true,
      isAllDay: false,
      attendees: JSON.stringify(["team@example.com", "stakeholder@example.com"]),
      source: "google",
      fetchedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const event of calendarData) {
    db.insert(calendarEventCache).values(event).run();
  }

  console.log(`Created ${taskData.length} tasks`);
  console.log(`Created ${calendarData.length} calendar events for tomorrow`);
  console.log("Seed completed!");

  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
