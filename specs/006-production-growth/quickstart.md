# Quickstart проверки production growth

## Подготовка

1. Применить `pnpm db:migrate` к тестовой PostgreSQL.
2. Оставить `TELEGRAM_STARS_MONTHLY_PRICE=0` для безопасного первого запуска.
3. Указать свой Telegram ID в `ADMIN_TELEGRAM_USER_IDS` локально/в Render.
4. Запустить `pnpm dev` и открыть Mini App с валидной Telegram-сессией.

## Legal

1. Открыть `/privacy` и `/terms` без авторизации.
2. Новый пользователь видит gate со ссылками и кнопкой принятия.
3. Принять документы, перезагрузить — gate не повторяется.
4. Сменить тестовую версию — gate появляется снова.

## Admin

1. Разрешённый ID открывает `/admin` и получает сводку.
2. Обычный пользователь получает `not_found`.
3. Сверить completed/follow-up/delivery с SQL fixture.
4. Убедиться, что JSON не содержит `telegramUserId`, `userId`, `sessionId`.

## Billing disabled/test

1. При price=0 status возвращает `enabled=false`, checkout — `billing_disabled`.
2. В Telegram test environment создать checkout после принятия документов.
3. Повторить webhook update — entitlement и срок не удваиваются.
4. Неверный secret даёт 401 без записи.
5. Проверить чужой, истёкший и несовпадающий по цене checkout.
6. Проверить автоматическое продление: появляется отдельное списание и новый конец периода.
7. Проверить canceled и failed subscription updates: оплаченный доступ не обрывается раньше срока.
8. Проверить команды `terms`, `privacy` и `paysupport` через защищённый webhook.

## Полная проверка

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

## Production gate

Реальные Stars нельзя включать, пока не заполнены реквизиты оператора, условия подписки/возврата, `/paysupport`, BotFather privacy URL, production webhook и ручной refund smoke-test.
