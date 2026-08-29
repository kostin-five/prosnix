import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../apps/web/dist/", import.meta.url));
const forbidden = [
  ["mock-история", "16 авг"],
  ["тестовый Telegram launch payload", "signed-test-launch-data"],
  ["пример токена бота", "replace-with-test-bot-token"],
  ["имя серверного секрета DeepSeek", "DEEPSEEK_API_KEY"],
  ["строка подключения PostgreSQL", "postgres://awc:awc@"],
];

for (const name of ["TELEGRAM_BOT_TOKEN", "DEEPSEEK_API_KEY", "DATABASE_URL", "SESSION_SECRET"]) {
  const value = process.env[name];
  if (value && value.length >= 8) forbidden.push([`значение ${name}`, value]);
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    }),
  );
  return nested.flat();
}

const assets = (await files(root)).filter((file) =>
  [".js", ".css", ".html"].includes(extname(file)),
);
const violations = [];
for (const file of assets) {
  const content = await readFile(file, "utf8");
  for (const [label, needle] of forbidden) {
    if (content.includes(needle)) violations.push(`${label}: ${file}`);
  }
}

if (violations.length > 0) {
  throw new Error(`Production bundle содержит запрещённые данные:\n${violations.join("\n")}`);
}
console.log(`Production boundaries: проверено ${assets.length} файлов, нарушений нет.`);
