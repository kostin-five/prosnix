# Onboarding разработчика Prosnix

## 1. Что установить

- Git;
- Node.js 22–24;
- pnpm 11.19.0 (`corepack enable`, затем `corepack prepare pnpm@11.19.0 --activate`);
- Docker Desktop для локальной PostgreSQL 17;
- Chromium для E2E: `pnpm exec playwright install chromium`.

Перед работой прочитайте документы в порядке из [`../../AGENTS.md`](../../AGENTS.md) и
[`NEW_CHAT_PROMPT.md`](NEW_CHAT_PROMPT.md). Актуальное состояние всегда определяется
[`CURRENT.md`](CURRENT.md), указанным в нём handoff и текущим Git, а не старым SHA в инструкции.

Для нового AI-чата скопируйте [`NEW_CHAT_PROMPT.md`](NEW_CHAT_PROMPT.md). Первый ответ нового агента
должен быть read-only аудитом; до подтверждения владельца он не меняет код, ветки и внешние сервисы.

## 2. Установка

```bash
git clone <repository-url>
cd prosnix
pnpm install --frozen-lockfile
cp .env.example .env
```

Не копируйте чужой `.env`. Заполните только собственные local/test значения.

## 3. Переменные окружения

`.env.example` — полный безопасный шаблон. Основные группы:

- runtime: `NODE_ENV`, `API_PORT`, `WEB_ORIGIN`;
- DB: `DATABASE_URL`, `POSTGRES_PORT`;
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEB_APP_URL`, auth max age;
- sessions/cron: `SESSION_SECRET`, `CRON_SECRET`;
- AI: `DEEPSEEK_*`, необязательны для fallback;
- limits/readiness: `*_RATE_LIMIT_MAX`, timeout variables;
- admin/legal/billing: allowlist, versions, Stars price и webhook secret;
- public web: `VITE_LEGAL_OPERATOR_NAME`, `VITE_LEGAL_CONTACT`.

Для demo допустим test bot token и пустой DeepSeek key. Используйте случайные local secrets длиной
не менее 32 символов. Переменные `VITE_*` попадают в браузер и никогда не содержат секреты.

API dev-script сам читает корневой `.env`; выполнять `source .env` не нужно.

## 4. Локальная база и запуск

```bash
pnpm db:start
pnpm db:migrate
pnpm dev
```

- web demo: `http://localhost:5190/?demo=1`;
- API liveness: `http://localhost:3001/health`;
- API readiness: `http://localhost:3001/ready`.

Остановить контейнер без удаления volume:

```bash
pnpm db:stop
```

Для реального Telegram local URL недостаточен: нужен HTTPS tunnel или staging. Не подключайте tunnel
к production DB.

## 5. Раздельный запуск

```bash
pnpm dev:web
pnpm dev:api
```

Production-like API:

```bash
pnpm build
pnpm start:api
```

## 6. Проверки

Во время разработки:

```bash
pnpm format:check
pnpm typecheck
pnpm test
```

Перед pull request:

```bash
pnpm verify:release
```

При изменениях DB/API/release:

```bash
pnpm test:integration
pnpm verify:release:full
```

Полное описание: [`../testing.md`](../testing.md).

## 7. Где смотреть логи

- local API пишет structured Fastify logs в terminal `pnpm dev:api`;
- ищите `requestId` и события `wake_session_transition`, `coach_insight_completed`,
  `notification dispatch`, `readiness_failed`;
- browser errors — Telegram WebView/DevTools или обычный browser в demo;
- E2E artifacts — `playwright-report/` и `test-results/`;
- remote API — Render service Logs; DB activity — панель фактически подключённого PostgreSQL
  provider, который необходимо подтвердить по актуальной конфигурации у владельца, не читая
  production connection string.

Не публикуйте строку запроса целиком, cookie, `initData`, Telegram update body или пользовательские
ответы.

## 8. Частые ошибки

| Симптом                   | Проверка                                                                       |
| ------------------------- | ------------------------------------------------------------------------------ |
| `pnpm: command not found` | активировать Corepack и pnpm 11.19.0                                           |
| порт 5432 занят           | изменить `POSTGRES_PORT` и порт в local `DATABASE_URL`                         |
| web-порт занят            | Vite выберет другой; Telegram/`WEB_ORIGIN` должны использовать фактический URL |
| `/ready` = 503            | состояние PostgreSQL, наличие `DATABASE_URL`, migration и timeout              |
| Telegram auth = 401       | token относится к другому боту, initData устарел или URL открыт не из Telegram |
| session write = 400       | отсутствует `Idempotency-Key` или для transition — `If-Match`                  |
| session write = 409       | клиентская версия устарела; загрузить canonical session/bootstrap              |
| cron = 415                | POST должен иметь `Content-Type: application/json` и тело `{}`                 |
| cron = 401                | Bearer secret не совпадает с `CRON_SECRET`                                     |
| AI показывает fallback    | это допустимо; проверить key/base URL/timeout в API, не в web                  |

## 9. Безопасный первый вклад

1. Выберите небольшой docs/UI/test bug без migration или production config.
2. После read-only аудита и согласия владельца создайте `codex/<short-topic>` от актуального `dev`.
3. Добавьте regression test, если меняется поведение.
4. Не перестраивайте архитектуру и не обновляйте зависимости «заодно».
5. Выполните `pnpm verify:release`.
6. В PR опишите пользовательский эффект, проверки, риски и отсутствие migration/secrets.

Для material feature начните с существующего подходящего OpenSpec change. Если задача имеет другой
scope, подготовьте новый change по правилам [`../../AGENTS.md`](../../AGENTS.md), а не начинайте с
кода.

## 10. Текущая точка продолжения

Откройте [`CURRENT.md`](CURRENT.md) и актуальный handoff. Там разделены завершённая локальная
разработка, ручные проверки и разрешение на production release. После чтения выполните только
read-only Git-аудит, перечисленный в стартовом промпте; не делайте вывод о production deploy из
наличия commit в `dev`. Точный SHA, зелёный CI, ручной Telegram smoke-test и решение владельца
проверяются отдельно по [`../release-checklist.md`](../release-checklist.md).
