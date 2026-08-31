# Prosnix

Telegram Mini App, который проводит контролируемые эксперименты пробуждения и учится подбирать
последовательность действий по подтверждённым данным пользователя. Рабочее имя раннего прототипа —
Adaptive Wake Coach; production-бот — `@prosnix_bot`.

Текущий MVP уже работает в Telegram: wake-сессии сохраняются на сервере, прерванный сценарий
восстанавливается, follow-up приходит через 15 минут, ежедневное напоминание можно отложить,
статистика воспроизводима, а DeepSeek только объясняет рассчитанные показатели и имеет безопасный
fallback.

## Архитектура

```text
Telegram Mini App
       │ signed initData / secure cookie
       ▼
apps/web (React + Vite)
       │ same-origin /api rewrite
       ▼
apps/api (Fastify)
       ├── packages/domain   — состояния сессий, эксперименты, аналитика
       ├── packages/db       — PostgreSQL, транзакции, миграции
       ├── Telegram Bot API  — ежедневные и follow-up сообщения
       └── DeepSeek          — только объяснение агрегатов
```

- `apps/web` — интерфейс Mini App, `/privacy`, `/terms` и приватный `/admin`;
- `apps/api` — Telegram-аутентификация, API, cron-dispatch, readiness и graceful shutdown;
- `packages/domain` — независимые детерминированные правила;
- `packages/db` — Drizzle/PostgreSQL repositories и forward-only миграции;
- `packages/contracts` — общие схемы ответов;
- `specs/` — русские спецификации, планы, задачи и отчёты проверки.

## Требования

- Node.js 22–24;
- pnpm 11.19.0;
- Docker Desktop для локальной PostgreSQL;
- Telegram-бот нужен только для реального запуска, demo работает без него.

## Первый локальный запуск

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:start
pnpm db:migrate
pnpm dev
```

- web: `http://localhost:5190/?demo=1`;
- API liveness: `http://localhost:3001/health`;
- API readiness с проверкой БД: `http://localhost:3001/ready`.

Если порт PostgreSQL занят, используйте [инструкцию инфраструктуры](infra/README.md). `.env`
загружается API dev-скриптом автоматически; выполнять `source .env` не требуется.

## Секреты и переменные

Локально значения находятся только в `.env`, на Render — только в Environment API Web Service.
Никогда не добавляйте серверные ключи в `VITE_*` или Static Site:

- `DATABASE_URL` — строка Neon/PostgreSQL;
- `TELEGRAM_BOT_TOKEN` — единственный токен staging-бота;
- `SESSION_SECRET` — случайная строка от 32 символов;
- `CRON_SECRET` — отдельная случайная строка от 32 символов для cron-job.org;
- `TELEGRAM_WEB_APP_URL` — HTTPS-адрес Static Site;
- `DEEPSEEK_API_KEY` — необязательный серверный ключ AI.

Полный перечень и безопасные значения по умолчанию находятся в [.env.example](.env.example).

## Проверки

Быстрая обязательная проверка без PostgreSQL integration и браузера:

```bash
pnpm verify:release
```

Полная проверка при уже запущенной и мигрированной локальной PostgreSQL:

```bash
pnpm db:start
pnpm db:migrate
pnpm verify:release:full
pnpm db:stop
```

Отдельные команды:

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm verify:web-bundle
pnpm verify:production
pnpm audit --prod --audit-level high
pnpm test:e2e
```

GitHub Actions повторяет полный набор на чистой PostgreSQL 17. Pull request нельзя считать готовым,
если jobs `verify` или `security` не прошли.

## Deploy и сопровождение

- ветка `dev` автоматически разворачивается Render как staging;
- Render API Health Check Path должен быть `/ready`, а `/health` используется как liveness;
- cron-job.org вызывает защищённый dispatch каждые пять минут;
- новая миграция всегда применяется до проверки нового API;
- откат к предыдущему commit не должен откатывать уже применённые миграции.

Пошаговые инструкции:

- [настройка Telegram, Render, Neon и cron-job.org](docs/telegram-mini-app-setup.md);
- [эксплуатация, smoke-test, backup, диагностика и rollback](docs/operations.md);
- [текущая дорожная карта](docs/release-roadmap.md).
- [переход на production-бота Prosnix](docs/prosnix-production.md);
- [юридический launch-checklist](docs/legal-launch-checklist.md).

## Статус безопасности

- Telegram `initData` проверяется серверной HMAC-подписью и временем;
- пользовательская cookie — `HttpOnly`, `Secure` в production и `SameSite=Strict`;
- API-ответы запрещают кэширование персональных данных и получают защитные HTTP-заголовки;
- Telegram auth и AI Coach ограничены по частоте, запросы — по размеру;
- secrets/test fixtures автоматически ищутся в production bundle;
- production dependency audit блокирует high/critical advisory;
- удаление профиля каскадно удаляет сессии, расписание и AI-кэш.

Сообщайте об уязвимостях приватно владельцу репозитория; не публикуйте токены, `initData`, cookie или
строки подключения в issue и скриншотах.
