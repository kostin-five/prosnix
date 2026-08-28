import {
  connectDatabase,
  PostgresAnalyticsRepository,
  PostgresBootstrapRepository,
  PostgresSessionCommandRepository,
} from "@awc/db";
import { createApp } from "./app/create-app.js";
import { loadConfig } from "./app/config.js";

const config = loadConfig();
const database = connectDatabase(config.databaseUrl);
const app = await createApp(config, {
  unitOfWork: database.unitOfWork,
  bootstrapRepository: new PostgresBootstrapRepository(database.db),
  sessionCommands: new PostgresSessionCommandRepository(database.db),
  analyticsRepository: new PostgresAnalyticsRepository(database.db),
});
app.addHook("onClose", async () => database.close());

await app.listen({ host: "0.0.0.0", port: config.port });
