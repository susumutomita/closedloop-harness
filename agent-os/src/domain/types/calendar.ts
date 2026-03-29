import { z } from "zod";

export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  externalId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.date(),
  endTime: z.date(),
  isAllDay: z.boolean(),
  isMeeting: z.boolean(),
  attendees: z.array(z.string()).nullable(),
  source: z.enum(["google", "manual"]),
  fetchedAt: z.date(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
