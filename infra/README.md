# Инфраструктура Adaptive Wake Coach

Приложение разворачивается как независимый от провайдера модульный монолит:

- `apps/web` is served from public HTTPS edge hosting.
- `/api/*` routes to the stateless `apps/api` service under the same origin.
- PostgreSQL is the canonical store and must provide encrypted connections, automated backups and
  point-in-time recovery in production.

## Окружения

Development, staging и production используют разные базы данных, секреты, настройки Telegram-бота
и публичные адреса. В production запрещено использовать значения из `.env.example`.

## Локальная база данных

```bash
pnpm db:start
pnpm db:migrate
```

Остановка: `pnpm db:stop`. Именованный volume сохраняется после обычной остановки.
Если порт `5432` занят, запустите контейнер с другим портом и используйте его же в URL базы:

```bash
POSTGRES_PORT=55432 pnpm db:start
DATABASE_URL=postgres://awc:awc@localhost:55432/awc pnpm db:migrate
```

## Совместимость схемы и откат

Каждая миграция должна быть обратно совместимой как минимум с предыдущей версией приложения:

1. Сначала добавляйте nullable-поля, таблицы и индексы, не удаляя старые структуры.
2. Разверните приложение, которое умеет читать старую и новую схему.
3. Выполните перенос данных отдельной контролируемой операцией.
4. Удаляйте старые поля только в следующем релизном цикле после проверки отката.

Перед production-деплоем примените миграции на копии staging-базы и запустите предыдущий образ
приложения. Он должен успешно пройти `/health` и чтение bootstrap без изменения данных.

## Проверка резервной копии

Не реже одного раза перед пилотом:

1. Создайте снапшот staging PostgreSQL и запишите время/идентификатор копии.
2. Восстановите его в новую изолированную базу, не поверх staging или production.
3. Примените текущие миграции через `pnpm db:migrate`.
4. Запустите API с адресом восстановленной базы и выполните health, bootstrap, resume и analytics.
5. Сверьте количество пользователей, сессий и наблюдений до/после; секреты и Telegram initData
   в отчёт не включайте.
6. Удалите тестовую базу только после фиксации результата и времени восстановления.

## Требования production

- Same-origin HTTPS delivery for web and API
- At least one always-on API instance; two instances when provider and pilot budget allow
- Managed PostgreSQL health monitoring and tested restore procedure
- Deployment health check and rollback to the prior application release
- Structured logs without Telegram launch payloads, bot tokens or wake-up answers

Провайдер выбирается после измерений staging: региональный трафик, размер базы и месячная стоимость.
