# Quickstart проверки: Продуктовая админ-панель

## Автоматические проверки

```bash
pnpm format:check
pnpm typecheck
pnpm test
DATABASE_URL=postgres://awc:awc@localhost:55432/awc_admin_dashboard_20260905 pnpm test:integration
pnpm build
pnpm verify:web-bundle
pnpm verify:production
pnpm test:e2e
```

Integration URL должен указывать только на отдельную локальную тестовую базу.

## Ручная проверка

1. Указать собственный Telegram ID в server-only `ADMIN_TELEGRAM_USER_IDS`.
2. Открыть Mini App владельцем, затем перейти на `/admin`.
3. Переключить 7, 30 и 90 дней; убедиться, что период, значения и timeline обновляются.
4. Сверить воронку: assigned не меньше started, started не меньше completed, completed не меньше followedUp.
5. Проверить пояснения среднего прироста и размера парной выборки.
6. Проверить контексты, длительности, retention, функции, доставки и billing.
7. Открыть `/admin` пользователем вне allowlist: должен отображаться закрытый экран без данных.
8. Проверить ширину 320 пикселей и отсутствие горизонтальной прокрутки страницы.
9. Проверить, что Network response не содержит `telegram`, `userId`, `sessionId`, UUID, ratings или routine text.

## Ожидаемый результат

- панель позволяет менее чем за 30 секунд увидеть основной провал воронки и успешность доставок;
- пустые периоды показывают нули и пустое состояние без ошибки;
- retry повторяет запрос;
- обычные пользовательские страницы не вызывают admin endpoint;
- initial web bundle остаётся не больше 250 КиБ.
