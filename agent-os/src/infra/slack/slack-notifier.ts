export interface SlackNotifier {
  postScheduleDraft(draft: {
    id: string;
    targetDate: string;
    items: Array<{
      title: string;
      startTime: string;
      endTime: string;
      blockType: string;
      reason: string;
      reviewRequired: boolean;
    }>;
    summary: string;
  }): Promise<{ ok: boolean; messageTs?: string }>;
}

export function createSlackNotifier(): SlackNotifier {
  const hasToken = process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID;

  if (hasToken) {
    return createRealSlackNotifier();
  }
  return createMockSlackNotifier();
}

function createMockSlackNotifier(): SlackNotifier {
  return {
    async postScheduleDraft(draft) {
      console.log("[MockSlack] Schedule Draft Posted:");
      console.log(`  Date: ${draft.targetDate}`);
      console.log(`  Summary: ${draft.summary}`);
      for (const item of draft.items) {
        const flag = item.reviewRequired ? " [REVIEW REQUIRED]" : "";
        console.log(`  ${item.startTime}-${item.endTime} | ${item.blockType} | ${item.title}${flag}`);
      }
      return { ok: true, messageTs: `mock-${Date.now()}` };
    },
  };
}

function createRealSlackNotifier(): SlackNotifier {
  const token = process.env.SLACK_BOT_TOKEN!;
  const channel = process.env.SLACK_CHANNEL_ID!;

  return {
    async postScheduleDraft(draft) {
      const blocks = [
        {
          type: "header",
          text: { type: "plain_text", text: `Schedule Draft for ${draft.targetDate}` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: draft.summary },
        },
        { type: "divider" },
        ...draft.items.map((item) => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${item.startTime} - ${item.endTime}*\n\`${item.blockType}\` ${item.title}${item.reviewRequired ? " :warning: _Review Required_" : ""}\n_${item.reason}_`,
          },
        })),
      ];

      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel, blocks, text: `Schedule Draft for ${draft.targetDate}` }),
      });

      const data = await response.json();
      return { ok: data.ok, messageTs: data.ts };
    },
  };
}
