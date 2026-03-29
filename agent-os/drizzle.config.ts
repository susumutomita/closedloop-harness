import type { Config } from "drizzle-kit";

export default {
  schema: "./src/infra/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./data/agent-os.db",
  },
} satisfies Config;
