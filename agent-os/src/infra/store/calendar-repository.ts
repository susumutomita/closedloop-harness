import { db } from "@/infra/db";
import { calendarEventCache } from "@/infra/db/schema";
import { and, gte, lte, asc } from "drizzle-orm";

export const calendarRepository = {
  async findByDateRange(start: Date, end: Date) {
    return db
      .select()
      .from(calendarEventCache)
      .where(
        and(
          gte(calendarEventCache.startTime, start.toISOString()),
          lte(calendarEventCache.endTime, end.toISOString()),
        ),
      )
      .orderBy(asc(calendarEventCache.startTime));
  },

  async upsertFromExternal(
    events: Array<{
      externalId: string;
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      isAllDay?: boolean;
      isMeeting?: boolean;
      attendees?: string[];
      source?: string;
    }>,
  ) {
    const results = [];
    for (const event of events) {
      const now = new Date().toISOString();
      await db
        .insert(calendarEventCache)
        .values({
          id: crypto.randomUUID(),
          externalId: event.externalId,
          title: event.title,
          description: event.description ?? null,
          startTime: event.startTime.toISOString(),
          endTime: event.endTime.toISOString(),
          isAllDay: event.isAllDay ?? false,
          isMeeting: event.isMeeting ?? false,
          attendees: event.attendees ? JSON.stringify(event.attendees) : null,
          source: event.source ?? "google",
          fetchedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: calendarEventCache.externalId,
          set: {
            title: event.title,
            description: event.description ?? null,
            startTime: event.startTime.toISOString(),
            endTime: event.endTime.toISOString(),
            isAllDay: event.isAllDay ?? false,
            isMeeting: event.isMeeting ?? false,
            attendees: event.attendees ? JSON.stringify(event.attendees) : null,
            fetchedAt: now,
            updatedAt: now,
          },
        });
      results.push(event);
    }
    return results;
  },
};
