# Проверка реализации: Telegram-напоминания

**Дата**: 2026-08-30

## Результаты

- `pnpm format:check` — PASS.
- `pnpm typecheck` — PASS для пяти workspace-пакетов.
- `pnpm test` — PASS: domain 15, web 4, API 23; PostgreSQL tests отдельно.
- `DATABASE_URL=... pnpm test:integration` на локальной PostgreSQL 17 — PASS: 6 тестов,
  включая параллельный claim одной доставки.
- `pnpm build` — PASS.
- `pnpm verify:web-bundle` — PASS: initial JS 220,2 КБ из лимита 250 КБ.
- `pnpm verify:production` — PASS: 4 production-файла, секретов и mock-данных нет.
- `pnpm test:e2e` — PASS: 7 mobile Chromium сценариев.
- `pnpm db:migrate` — PASS на Neon staging; добавлены таблицы расписаний и доставок.
- `pnpm --filter @awc/api notifications:dispatch` — PASS на Neon staging, zero-due run:
  `claimed=0`, `sent=0`, ошибок нет.
- Контракт `POST /internal/notifications/dispatch` — PASS: ответы 401/200/503, batch не более 10,
  параллельность не более 5, секреты и Telegram ID не попадают в ответ.

## Ограничения до включения доставки

- Код ещё должен развернуться из ветки `dev` на Render.
- В Render API Environment требуется `TELEGRAM_WEB_APP_URL`.
- Требуется настроить cron-job.org с отдельным `CRON_SECRET` и защищённым POST endpoint.
- Реальное due-срабатывание и сообщение проверяются после deploy; текущий smoke-test намеренно не
  создавал расписание и не отправлял Telegram-сообщения.
- API Web Service может безопасно стартовать до добавления настроек; endpoint проверяет наличие
  `CRON_SECRET` и `TELEGRAM_WEB_APP_URL` и вернёт 503 до доступа к очереди, если настройка не
  завершена.
