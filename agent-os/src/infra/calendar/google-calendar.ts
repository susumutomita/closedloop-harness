export interface CalendarProvider {
  fetchEvents(startDate: Date, endDate: Date): Promise<Array<{
    externalId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    isAllDay?: boolean;
    isMeeting?: boolean;
    attendees?: string[];
  }>>;
  createEvent(event: {
    title: string;
    description?: string;
    startTime: Date | string;
    endTime: Date | string;
  }): Promise<{ externalId: string }>;
}

export function createCalendarProvider(): CalendarProvider {
  const hasCredentials = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

  if (hasCredentials) {
    return createGoogleCalendarProvider();
  }
  return createMockCalendarProvider();
}

function createMockCalendarProvider(): CalendarProvider {
  return {
    async fetchEvents(startDate: Date, endDate: Date) {
      const dateStr = startDate.toISOString().split("T")[0];
      return [
        {
          externalId: `mock-standup-${dateStr}`,
          title: "Daily Standup",
          startTime: new Date(`${dateStr}T09:30:00`),
          endTime: new Date(`${dateStr}T09:45:00`),
          isMeeting: true,
          attendees: ["team@example.com"],
        },
        {
          externalId: `mock-1on1-${dateStr}`,
          title: "1:1 with Manager",
          startTime: new Date(`${dateStr}T14:00:00`),
          endTime: new Date(`${dateStr}T14:30:00`),
          isMeeting: true,
          attendees: ["manager@example.com"],
        },
        {
          externalId: `mock-review-${dateStr}`,
          title: "Sprint Review",
          startTime: new Date(`${dateStr}T16:00:00`),
          endTime: new Date(`${dateStr}T17:00:00`),
          isMeeting: true,
          attendees: ["team@example.com", "stakeholder@example.com"],
        },
      ];
    },
    async createEvent(event) {
      console.log("[MockCalendar] Would create event:", event.title);
      return { externalId: `mock-created-${Date.now()}` };
    },
  };
}

function createGoogleCalendarProvider(): CalendarProvider {
  // Real Google Calendar integration - requires OAuth setup
  return {
    async fetchEvents(_startDate: Date, _endDate: Date) {
      // TODO: Implement real Google Calendar API integration
      // This would use googleapis package with OAuth2 credentials
      throw new Error("Google Calendar integration not yet configured. Set GOOGLE_CLIENT_ID etc.");
    },
    async createEvent(_event) {
      throw new Error("Google Calendar integration not yet configured.");
    },
  };
}
