import { lt } from "drizzle-orm";

import type { NotificationMaintenanceRepository } from "@awc/domain";
import { followUpNotificationDeliveries, notificationDeliveries } from "../schema.js";
import type { Database } from "./types.js";

export class PostgresNotificationMaintenanceRepository implements NotificationMaintenanceRepository {
  constructor(private readonly db: Database) {}

  async pruneBefore(cutoff: Date): Promise<{ wakeDeleted: number; followUpDeleted: number }> {
    return this.db.transaction(async (transaction) => {
      const db = transaction as Database;
      const wakeDeleted = await db
        .delete(notificationDeliveries)
        .where(lt(notificationDeliveries.createdAt, cutoff))
        .returning({ id: notificationDeliveries.id });
      const followUpDeleted = await db
        .delete(followUpNotificationDeliveries)
        .where(lt(followUpNotificationDeliveries.createdAt, cutoff))
        .returning({ id: followUpNotificationDeliveries.id });
      return { wakeDeleted: wakeDeleted.length, followUpDeleted: followUpDeleted.length };
    });
  }
}
