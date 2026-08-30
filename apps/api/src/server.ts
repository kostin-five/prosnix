import {
  connectDatabase,
  PostgresFollowUpNotificationRepository,
  PostgresNotificationMaintenanceRepository,
  PostgresAnalyticsRepository,
  PostgresBootstrapRepository,
  PostgresSessionCommandRepository,
  PostgresUserDeletionRepository,
  PostgresWakeNotificationRepository,
  PostgresWakeScheduleRepository,
} from "@awc/db";
import { createApp } from "./app/create-app.js";
import { loadConfig } from "./app/config.js";
import { TelegramBotGateway } from "./notifications/telegram.js";

const config = loadConfig();
const database = connectDatabase(config.databaseUrl);
const app = await createApp(config, {
  unitOfWork: database.unitOfWork,
  bootstrapRepository: new PostgresBootstrapRepository(database.db),
  sessionCommands: new PostgresSessionCommandRepository(database.db),
  analyticsRepository: new PostgresAnalyticsRepository(database.db),
  userDeletionRepository: new PostgresUserDeletionRepository(database.db),
  wakeScheduleRepository: new PostgresWakeScheduleRepository(database.db),
  wakeNotificationRepository: new PostgresWakeNotificationRepository(database.db),
  notificationGateway: new TelegramBotGateway(config.botToken, config.telegramWebAppUrl),
  followUpNotificationRepository: new PostgresFollowUpNotificationRepository(database.db),
  notificationMaintenanceRepository: new PostgresNotificationMaintenanceRepository(database.db),
});
app.addHook("onClose", async () => database.close());

await app.listen({ host: "0.0.0.0", port: config.port });
