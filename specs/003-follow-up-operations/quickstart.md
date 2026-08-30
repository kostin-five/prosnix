# Быстрая проверка: Follow-up и эксплуатационная надёжность

## Предварительные условия

- Миграция `0002_follow_up_notifications.sql` применена.
- API Environment содержит `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEB_APP_URL`,
  `SESSION_SECRET` и `CRON_SECRET`.
- cron-job.org отправляет POST с `{}` и `Content-Type: application/json`.

## Автоматические проверки

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm verify:web-bundle
pnpm verify:production
pnpm test:e2e
```

Ожидается: проверки проходят, миграция идемпотентна, bundle остаётся меньше 250 КБ.

## Проверка follow-up

1. Завершить wake-протокол и не отвечать на follow-up.
2. После срока выполнить защищённый dispatch.
3. Убедиться, что `followUp.claimed=1`, `followUp.sent=1` и пришло сообщение с кнопкой.
4. Повторить dispatch: второго сообщения нет.
5. В другой сессии ответить до срока: `followUp.sent=0`.
6. Открыть кнопку и убедиться, что показан существующий follow-up.

## Проверка обслуживания

1. Integration fixture создаёт старую и свежую запись каждого типа.
2. Dispatch удаляет только записи старше 90 дней.
3. Повторный cleanup возвращает нули.
4. Wake-сессии и observations остаются доступны.

## Ожидаемый служебный ответ

Ответ содержит `wake`, `followUp`, `total`, `maintenance`, `durationMs`, `maxLagMs`. В нём не должно
быть токена, Telegram ID, session/user ID или текста ответа.
