# План 0.4: проверка интереса к Pro

**Ветка**: `dev` | **Дата**: 7 сентября 2026 года | **Спецификация**:
[`spec.md`](./spec.md)

## Кратко

Добавляем небольшой versioned research offer в существующем модульном монолите. Server-side repository
считает eligibility по completed sessions, сохраняет один idempotent response и добавляет только
семь агрегатов к действующей admin summary. Web лениво загружает необязательную карточку в статистике.
Ни один путь не вызывает billing, Telegram Stars, checkout или provider SDK.

## Технический контекст

- **Язык**: TypeScript strict, ESM.
- **Клиенты**: React/Vite Telegram Mini App, Fastify API.
- **Хранилище**: PostgreSQL + Drizzle, migrations `0008` и совместимый forward-only repair `0009`.
- **Границы**: domain ports не импортируют Fastify/Drizzle/React; API проверяет Telegram identity;
  browser использует только API; admin получает только агрегаты.
- **Проверки**: unit/contract, disposable PostgreSQL integration, mobile Playwright, typecheck и
  release full перед merge.

## Constitution check

| Принцип                         | Решение                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| I. Reliable Wake-Up Continuity  | Карточка live только в stats, ошибка скрывает её и не влияет на wake flow.                   |
| II. Truthful Experimentation    | Текст называет предложение исследованием, не утверждает эффект и не меняет метрики.          |
| III. Privacy and Security       | Ответ владеет серверный user ID; admin видит только счётчики; нет provider payload.          |
| IV. Modular Domain Architecture | Status/repository остаются domain ports; DB и UI подключаются через существующие границы.    |
| V. Testable Delivery            | Есть contract, integration и E2E сценарии; новая persistence покрыта каскадным удалением.    |
| VI. Controlled Change           | Одна reviewed spec, forward-only migration, без production execution и новой инфраструктуры. |

## Проектная структура

```text
packages/contracts/src/index.ts                         # API input schema
packages/domain/src/ports.ts                            # ports и aggregate
packages/db/src/schema.ts                               # Drizzle schema
packages/db/migrations/0008_pro_interest_responses.sql # forward-only schema
packages/db/migrations/0009_subscription_status_repair.sql # idempotent enum repair
packages/db/src/repositories/admin-analytics.ts        # legacy-enum-compatible aggregate
packages/db/src/repositories/pro-interest.ts            # canonical repository
apps/api/src/pro-interest/routes.ts                     # authenticated HTTP boundary
apps/api/src/app/create-app.ts                           # route registration
apps/api/src/server.ts                                  # production dependency wiring
apps/api/src/admin/routes.ts                            # aggregate presentation
apps/web/src/features/pro-interest/                     # lazy card, hook and browser API client
apps/web/src/features/research/stats-research-cards.tsx # shared stats-only lazy boundary
tests/e2e/analytics.spec.ts                             # mobile user journey
tests/e2e/admin-dashboard.spec.ts                       # owner/error admin regression
```

## Последовательность

1. Описать contracts/ports/schema и тестовые ожидаемые результаты.
2. Добавить migration, repository и dependency wiring.
3. Добавить authenticated routes и admin aggregates.
4. Добавить необязательную lazy UI-card и доступный mobile interaction.
5. Проверить contracts, disposable DB, E2E и документацию.
6. Сделать billing aggregate совместимым со старым enum через сравнение `status::text`, затем
   forward-only migration добавить `past_due` в enum для последующих записей.
7. Передать в PostgreSQL admin repository server-side billing flag; при цене `0` не выполнять
   запросы к optional billing tables, при включённом billing сохранить канонический подсчёт.

## Откат и failure mode

Кодовый откат просто перестаёт показывать карточку; применённая migration не откатывается. Ошибка
загрузки/отправки не блокирует экран и не требует fallback к фиктивным данным. Единственная запись на
пользователя/version защищена unique constraint и `on conflict do nothing`.

Repair migration использует `ADD VALUE IF NOT EXISTS`: кодовый rollback не удаляет enum-значение.
До применения migration чтение admin остаётся работоспособным, но запись `past_due` требует уже
обновлённую схему. Production migration выполняется только после отдельного решения владельца.
