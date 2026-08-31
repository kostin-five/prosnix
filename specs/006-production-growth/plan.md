# План реализации: Production growth Prosnix

**Ветка**: `dev` | **Дата**: 31 августа 2026 | **Спецификация**: [spec.md](./spec.md)

## Краткое описание

Расширить текущий модульный монолит четырьмя вертикальными срезами: агрегированная owner-аналитика с Telegram allowlist; версионированный юридический gate и публичные документы Prosnix; выключенная по умолчанию месячная подписка Telegram Stars; инструкция безопасного перевода текущих Render/Neon на `@prosnix_bot`. Канонические сессии остаются источником продуктовых метрик, а платёжное право определяется только сервером.

## Технический контекст

**Язык/версия**: TypeScript 5.9, Node.js 22–24
**Основные зависимости**: React 18, Vite, Fastify 5, TypeBox, Drizzle ORM 0.45, postgres.js, Telegram Bot API
**Хранилище**: PostgreSQL 17 / Neon, миграции Drizzle SQL
**Тестирование**: Vitest unit/contract/integration, Playwright mobile E2E, PostgreSQL 17 в CI
**Целевая платформа**: Telegram Mini App; Render Static Site + Render Web Service
**Тип проекта**: pnpm monorepo, web + API + domain + DB + contracts
**Производительность**: агрегированная сводка p95 < 2 секунд на 10 000 пользователей; обычный bootstrap не замедляется новой аналитикой
**Ограничения**: бесплатная инфраструктура, один bot token, никаких сторонних analytics SDK, минимум платёжных данных, продажи выключены по умолчанию
**Масштаб**: один владелец, первые 10–100 beta-пользователей, архитектурный запас до 10 000 пользователей

## Проверка конституции

- **I. Надёжность** — PASS: новые таблицы добавляются вперёд-совместимой миграцией; billing выключен при ошибке конфигурации; сессии не меняются.
- **II. Честные эксперименты** — PASS: админ-метрики вычисляются из канонических наблюдений, формулы и когорты документируются; AI не участвует.
- **III. Privacy/Security** — PASS: allowlist только на сервере; dashboard не возвращает личности; webhook имеет отдельный секрет; документы и удаления определены.
- **IV. Модульность** — PASS: порты домена отделяют SQL, Telegram gateway и UI; платежи не внедряются в wake-session state machine.
- **V. Проверяемость** — PASS: contract, integration и UI-тесты обязательны; миграция и повторные webhook-события проверяются.

После проектирования gates остаются PASS. Исключений из конституции нет.

## Структура проекта

### Документация функции

```text
specs/006-production-growth/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/http-api.md
├── checklists/requirements.md
└── tasks.md
```

### Исходный код

```text
apps/api/src/{admin,billing,legal,app}/
apps/web/src/features/{admin,billing,legal}/
packages/domain/src/{admin,billing,legal}/
packages/db/src/repositories/{admin-analytics,billing,legal}.ts
packages/db/migrations/0004_production_growth.sql
packages/contracts/src/index.ts
apps/api/tests/{contract,integration}/
apps/web/src/**/*.test.tsx
docs/
```

**Решение по структуре**: сохранить существующий модульный монолит. API оркестрирует маршруты и Telegram transport; domain определяет типы/порты; DB реализует агрегаты и атомарные переходы; web показывает только server-provided состояние.

## Архитектурные решения

1. Админ-панель использует обычную Telegram cookie-сессию плюс `ADMIN_TELEGRAM_USER_IDS`; пустой allowlist закрывает доступ всем.
2. Метрики считаются SQL-агрегациями из `users`, `wake_sessions`, `follow_up_observations`, delivery-таблиц и subscriptions. Отдельный трекер кликов не добавляется.
3. Юридическое принятие хранится одной актуальной записью на пользователя с версиями обоих документов; смена версии требует нового принятия.
4. Billing включается только при положительной `TELEGRAM_STARS_MONTHLY_PRICE` и непустом webhook secret.
5. Checkout создаётся в БД до запроса `createInvoiceLink`; payload содержит только случайный checkout UUID.
6. Telegram webhook сначала сверяет `X-Telegram-Bot-Api-Secret-Token`, затем обрабатывает `pre_checkout_query` или `successful_payment`.
7. Уникальные `update_id` и `telegram_payment_charge_id` обеспечивают идемпотентность; активация выполняется транзакционно.
8. UI открывает invoice через Telegram WebApp API и после закрытия перечитывает серверный статус.
9. Политика и соглашение используют публичную конфигурацию оператора с честным fallback для закрытого теста; публичный чек-лист блокирует заявление о полной готовности без реквизитов.

## Миграция и rollback

- `0004` только добавляет enum/таблицы/индексы и не меняет существующие данные.
- Новые внешние ключи используют cascade с пользователем; processed updates не содержат user ID.
- При rollback приложение старой версии игнорирует новые таблицы. Удалять таблицы при аварийном откате нельзя.
- Перед deploy: backup Neon; после deploy: migrate, `/ready`, auth, legal status, admin denial, billing disabled smoke-test.

## Наблюдаемость и безопасность

- Логи: тип операции, request ID, checkout ID; без bot token, webhook secret, Telegram ID, оценок и payload оплаты.
- Отдельные rate limits для admin, checkout и webhook.
- `Cache-Control: no-store` уже применяется ко всем `/api` и `/internal`.
- Ошибки наружу используют стабильные коды; Telegram raw response не возвращается клиенту.
- Админ-агрегаты не кэшируются публично и не содержат малых когорт по отдельным сегментам.

## Отслеживание сложности

Нарушений конституции нет. Новые модули нужны для отделения разных trust boundaries; отдельный сервис или отдельная админ-БД на текущем масштабе не оправданы.
