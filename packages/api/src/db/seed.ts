import db from "./index";
import * as schema from "./schema";
import { reset, seed } from "drizzle-seed";

async function main() {
  await reset(db, schema);
  await seed(db, schema).refine(() => ({
    users: { count: 10 },
    sessions: { count: 0 },
    accounts: { count: 0 },
    verifications: { count: 0 },
    Notifications: { count: 0 },
    NotificationDeliveries: { count: 0 },
    PushTokens: { count: 0 },
  }));
}

main();
