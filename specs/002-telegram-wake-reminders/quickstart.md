# Быстрая проверка: Telegram-напоминания

## Предварительные условия

- `.env` содержит `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET` и
  `TELEGRAM_WEB_APP_URL=https://wake-coach-1.onrender.com/`.
- Миграции применены к тестовой/локальной БД.
- Пользователь открыл личный чат с `@wake_coach_bot`.

## Автоматические проверки

```bash
pnpm format:check
pnpm typecheck
pnpm db:migrate
pnpm test
pnpm test:integration
pnpm build
pnpm verify:web-bundle
pnpm verify:production
pnpm test:e2e
```

Ожидается: все проверки проходят; миграция повторно не меняет схему.

## Проверка UI и хранения

1. Открыть Mini App и изменить время на ближайшее.
2. Включить Telegram-напоминание и сохранить.
3. Проверить показ следующего срабатывания и предупреждение о природе напоминания.
4. Перезагрузить Mini App: время, timezone и enabled должны сохраниться.
5. Выключить расписание и убедиться, что `nextTriggerAt` стал `null`.

## Проверка доставки на staging

1. В Neon staging сохранить тестовому пользователю время не позже пяти минут от текущего.
2. В Render вручную запустить Notification Cron Job или дождаться очередного запуска.
3. Убедиться, что пришло одно сообщение с кнопкой запуска приложения.
4. Запустить job повторно: второго сообщения для того же `scheduled_for` быть не должно.
5. Заблокировать тестового бота, создать следующее due-срабатывание и запустить job.
6. После открытия Mini App проверить статус «бот не может отправить сообщение».

## Настройка Render Cron Job

- Environment: тот же `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEB_APP_URL`, что у API.
- Build Command: `pnpm install --frozen-lockfile && pnpm build`.
- Command: `pnpm --filter @awc/api notifications:dispatch`.
- Schedule: каждые пять минут.

Секреты добавляются в раздел Environment конкретного Cron Job в Render Dashboard. Они не
добавляются в GitHub и не имеют префикса `VITE_`.
