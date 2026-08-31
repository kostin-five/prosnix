# Проверка релизного усиления

## Предварительные условия

- Node.js 22;
- pnpm 11.19.0;
- Docker с PostgreSQL 17 для integration;
- `.env` создан из `.env.example`, секреты не закоммичены.

## 1. Зависимости и безопасность

```bash
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level high
```

Ожидается 0 high/critical production advisory.

## 2. Статические и автоматические проверки

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm verify:web-bundle
pnpm verify:production
pnpm test:e2e
```

## 3. PostgreSQL integration

```bash
pnpm db:start
pnpm db:migrate
pnpm test:integration
pnpm db:stop
```

## 4. HTTP smoke

После локального запуска:

```bash
curl --fail --silent http://localhost:3001/health
curl --fail --silent http://localhost:3001/ready
curl --head --silent http://localhost:3001/health
```

Ожидаются `status=ok`, `status=ready`, защитные заголовки и отсутствие секретов.

## 5. Staging после deploy

1. Установить Render Health Check Path в `/ready`.
2. Проверить `/health` и `/ready` через API и rewrite Static Site.
3. Запустить Mini App из Telegram и пройти одну сессию.
4. Проверить restart, статистику, snooze и follow-up.
5. При ошибке следовать [операционной инструкции](../../docs/operations.md).
