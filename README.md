# Adaptive Wake Coach

Telegram Mini App, которое изучает, какие управляемые действия помогают конкретному пользователю
проснуться и не вернуться в кровать.

## Архитектура

- `apps/web` — React/Vite интерфейс;
- `apps/api` — Fastify API и серверная проверка Telegram `initData`;
- `packages/domain` — переходы wake-сессии и воспроизводимая аналитика;
- `packages/db` — PostgreSQL schema, миграции и транзакции;
- `packages/contracts` — общие API-схемы;
- `specs/001-wake-data-foundation` — спецификация, план и валидация.

## Локальный запуск

```bash
pnpm install
cp .env.example .env
pnpm db:start
pnpm db:migrate
pnpm dev
```

Если PostgreSQL-порт `5432` занят, используйте [infra/README.md](infra/README.md). Локальный demo
открывается по URL Vite с `?demo=1` и никогда не включается в production.

## Проверки

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm verify:production
pnpm test:e2e
```

## Запуск в Telegram

Настройка BotFather, HTTPS, переменных и smoke-теста описана в
[docs/telegram-mini-app-setup.md](docs/telegram-mini-app-setup.md).
