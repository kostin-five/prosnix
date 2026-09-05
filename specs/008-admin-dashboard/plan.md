# План реализации: Продуктовая админ-панель

**Ветка**: `dev` | **Дата**: 5 сентября 2026 года | **Спецификация**: [spec.md](./spec.md)

## Краткое описание

Расширить существующий owner-only `/admin` и `GET /api/v1/admin/growth`, сохранив текущую Telegram-аутентификацию и server allowlist. PostgreSQL формирует согласованную когортную сводку из канонических таблиц, API добавляет только безопасные коэффициенты, а лениво загружаемый React-экран показывает воронку, качество пробуждений, динамику, retention, использование функций, доставки и billing без индивидуальных данных.

## Технический контекст

**Язык/версия**: TypeScript 5.9, Node.js 22–24, ESM, strict

**Основные зависимости**: React 18, Vite 6, Fastify 5, Drizzle ORM, postgres.js, существующий CSS/Tailwind слой

**Хранилище**: существующая PostgreSQL/Neon схема; новая миграция не требуется

**Тестирование**: Vitest domain/API/web, PostgreSQL integration, Playwright mobile E2E

**Целевая платформа**: закрытый web-экран Telegram Mini App и мобильный браузер

**Тип проекта**: pnpm-монорепозиторий web + API + domain/contracts/db

**Цели производительности**: одна сводка p95 до 2 секунд при 10 000 пользователях; не более 90 дневных точек; отсутствие запросов панели в пользовательском bootstrap

**Ограничения**: только агрегаты, без внешнего analytics SDK, без пользовательских идентификаторов, без новых runtime-зависимостей и без записи аналитических событий

**Масштаб**: один или несколько allowlisted владельцев; периоды 7/30/90 дней; первые 10 000 пользователей

## Проверка конституции

- **I. Надёжность** — PASS: функция read-only, не меняет wake-сессии и имеет retry/empty/error состояния.
- **II. Честные эксперименты** — PASS: воронка использует одну когорту; эффект только из пар оценок; размер выборки и ограничения показаны.
- **III. Privacy/Security** — PASS: Telegram cookie + server allowlist; 404 fail-closed; ответ не содержит идентификаторов или индивидуальных наблюдений.
- **IV. Модульность** — PASS: типы находятся в domain/contracts, SQL только в DB repository, UI не рассчитывает исходные метрики.
- **V. Проверяемость** — PASS: contract, integration, component и E2E-проверки входят в задачи.
- **VI. Контролируемые изменения** — PASS: переиспользуются существующие маршрут, repository и инфраструктура; миграция и новый provider не нужны.

После проектирования все gates остаются PASS. Исключений нет.

## Структура проекта

### Документация функции

```text
specs/008-admin-dashboard/
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
packages/domain/src/ports.ts
packages/contracts/src/index.ts
packages/db/src/repositories/admin-analytics.ts
apps/api/src/admin/routes.ts
apps/api/tests/contract/admin-growth.test.ts
apps/api/tests/integration/production-growth.test.ts
apps/web/src/features/admin/admin-screen.tsx
apps/web/tests/admin-dashboard.test.tsx
tests/e2e/admin-dashboard.spec.ts
docs/{architecture,api-contracts,product-roadmap}.md
docs/handoffs/
```

**Решение по структуре**: расширить существующий вертикальный срез admin внутри модульного монолита. Новая база, event collector, chart library и отдельный admin service не нужны.

## Архитектурные решения

1. API сохраняет обратную совместимость существующих полей и добавляет `funnel`, `wakeQuality`, `timeline`, `breakdowns`, `features` и расширенную delivery-сводку.
2. Сессии попадают в когортную воронку по `wake_sessions.created_at >= from AND < to`; последующие стадии также должны произойти до `to`.
3. Эффект рассчитывается только для сессий когорты с единственной baseline и post-protocol оценкой; delta равна post минус baseline.
4. Timeline строится сервером для всех UTC-дней, чтобы UI не додумывал отсутствующие данные.
5. Контексты и бюджеты имеют фиксированный ограниченный набор; массивы не содержат идентификаторов.
6. Retention остаётся совместимым с текущим определением: наличие завершённой сессии в UTC-день D1/D7 относительно создания пользователя.
7. AI usage берётся из `coach_insights.generated_at`; это число созданных объяснений, не просмотров.
8. Общие HTTP-ошибки остаются в Render logs. В панели явно показываются только сохранённые ошибки Telegram-доставки.
9. UI использует CSS-полосы и таблицы, без тяжёлой chart dependency, чтобы не увеличивать initial bundle; `/admin` уже lazy-loaded.

## Производительность и запросы

- Независимые aggregate-запросы выполняются параллельно через `Promise.all`.
- Все периодические агрегаты ограничены `[from, to)` и возвращают максимум 90 timeline rows и
  фиксированные breakdown rows; all-time users и текущие подписки явно остаются snapshot-метриками.
- Существующие индексы по времени и статусам переиспользуются; при первых 10 000 пользователях новый индекс не требуется.
- Если последующий `EXPLAIN ANALYZE` покажет выход за 2 секунды, индекс добавляется отдельной forward-only миграцией и ADR.

## Наблюдаемость, безопасность и rollback

- Маршрут сохраняет `Cache-Control: no-store` и rate limit 30 запросов в минуту.
- Неавторизованный запрос завершается до запуска SQL-агрегаций.
- Ошибки наружу не содержат SQL или конфигурацию; стандартный request log фиксирует route/status/duration без identity.
- Изменение read-only и не требует миграции. Rollback — возврат предыдущего кода; данные и схема не изменяются.

## Отслеживание сложности

Нарушений конституции и новой архитектурной сложности нет.
