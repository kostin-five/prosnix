import { connectDatabase, PostgresWakeNotificationRepository } from "@awc/db";
import { loadConfig } from "../app/config.js";
import { TelegramBotGateway } from "./telegram.js";
import { runNotificationWorker } from "./worker.js";

const config = loadConfig();
const database = connectDatabase(config.databaseUrl);
try {
  await runNotificationWorker(
    new PostgresWakeNotificationRepository(database.db),
    new TelegramBotGateway(config.botToken, config.telegramWebAppUrl),
  );
} finally {
  await database.close();
}
