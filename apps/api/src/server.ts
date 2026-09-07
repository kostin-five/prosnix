import {
  connectDatabase,
  PostgresFollowUpNotificationRepository,
  PostgresNotificationMaintenanceRepository,
  PostgresAnalyticsRepository,
  PostgresBootstrapRepository,
  PostgresCoachInsightRepository,
  PostgresSessionCommandRepository,
  PostgresSessionHistoryRepository,
  PostgresUserDeletionRepository,
  PostgresWakeNotificationRepository,
  PostgresWakeScheduleRepository,
  PostgresAdminGrowthRepository,
  PostgresBillingRepository,
  PostgresLegalAcceptanceRepository,
  PostgresWakePersonalizationRepository,
  PostgresExperimentFeedbackRepository,
} from "@awc/db";
import { createApp } from "./app/create-app.js";
import { loadConfig } from "./app/config.js";
import { TelegramBotGateway } from "./notifications/telegram.js";
import { DeepSeekCoachGateway } from "./coach/deepseek.js";
import { createGracefulShutdown, type ShutdownSignal } from "./runtime/graceful-shutdown.js";
import { TelegramBotStarsGateway } from "./billing/telegram-stars.js";

const config = loadConfig();
const database = connectDatabase(config.databaseUrl);
const app = await createApp(config, {
  unitOfWork: database.unitOfWork,
  bootstrapRepository: new PostgresBootstrapRepository(database.db),
  sessionCommands: new PostgresSessionCommandRepository(database.db),
  analyticsRepository: new PostgresAnalyticsRepository(database.db),
  coachInsightRepository: new PostgresCoachInsightRepository(database.db),
  coachGateway: config.deepseekApiKey
    ? new DeepSeekCoachGateway({
        apiKey: config.deepseekApiKey,
        baseUrl: config.deepseekBaseUrl,
        model: config.deepseekModel,
        timeoutMs: config.deepseekTimeoutMs,
      })
    : null,
  sessionHistoryRepository: new PostgresSessionHistoryRepository(database.db),
  userDeletionRepository: new PostgresUserDeletionRepository(database.db),
  wakeScheduleRepository: new PostgresWakeScheduleRepository(database.db),
  wakeNotificationRepository: new PostgresWakeNotificationRepository(database.db),
  notificationGateway: new TelegramBotGateway(config.botToken, config.telegramWebAppUrl),
  followUpNotificationRepository: new PostgresFollowUpNotificationRepository(database.db),
  notificationMaintenanceRepository: new PostgresNotificationMaintenanceRepository(database.db),
  readinessCheck: database.check,
  adminGrowthRepository: new PostgresAdminGrowthRepository(database.db),
  legalAcceptanceRepository: new PostgresLegalAcceptanceRepository(database.db),
  wakePersonalizationRepository: new PostgresWakePersonalizationRepository(database.db),
  experimentFeedbackRepository: new PostgresExperimentFeedbackRepository(database.db),
  billingRepository: new PostgresBillingRepository(database.db),
  telegramStarsGateway: new TelegramBotStarsGateway(config.botToken),
});
app.addHook("onClose", async () => database.close());

await app.listen({ host: "0.0.0.0", port: config.port });

const shutdown = createGracefulShutdown({
  close: async () => {
    app.log.info({ event: "shutdown_started" }, "graceful shutdown started");
    await app.close();
    app.log.info({ event: "shutdown_completed" }, "graceful shutdown completed");
  },
  deadlineMs: config.shutdownTimeoutMs,
  onDeadline: () => {
    app.log.error({ event: "shutdown_deadline_exceeded" }, "graceful shutdown deadline exceeded");
    process.exit(1);
  },
  onError: () => {
    app.log.error({ event: "shutdown_failed" }, "graceful shutdown failed");
  },
});

for (const signal of ["SIGTERM", "SIGINT"] satisfies ShutdownSignal[]) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}
