# Задачи 0.4: проверка интереса к Pro

## Phase 1: Контракты и persistence

- [x] T001 Добавить input contract и domain ports для versioned pro-interest status и aggregate (FR-003, FR-004, FR-006).
- [x] T002 Добавить forward-only migration `0008`, Drizzle schema и canonical PostgreSQL repository с cascade/idempotency (FR-005, FR-008).
- [x] T003 Добавить contract и disposable PostgreSQL integration tests для eligibility, validation, retry и удаления профиля (FR-001, FR-003, FR-004, FR-005, FR-008).

## Phase 2: Server integration

- [x] T004 Добавить authenticated GET/POST routes, production wiring и безопасный 409 response (FR-001, FR-003, FR-007).
- [x] T005 Добавить в существующий admin growth summary только агрегированные pro-interest counters (FR-006).

## Phase 3: Пользовательский путь

- [x] T006 Добавить lazy, неблокирующую stats-card и API hook с честным текстом без цены/checkout (FR-001, FR-002, FR-004, FR-007).
- [x] T007 Добавить mobile E2E journey: positive intent с focus, concealment after submit и safe API degradation (SC-001, SC-004).

## Phase 4: Документация и валидация

- [x] T008 Обновить architecture, API contracts, roadmap, validation и handoff с явным release gate (FR-002, FR-005, FR-006).

## Phase 5: Совместимость production enum и диагностика admin

- [x] T009 [US4] Добавить unit/contract regression для billing aggregate и безопасного request ID в `apps/api/tests/contract/admin-growth.test.ts` и `apps/web/tests/admin-dashboard.test.tsx` (FR-009, SC-005).
- [x] T010 [US4] Добавить PostgreSQL integration regression старого enum и состояния `past_due` в `apps/api/tests/integration/admin-dashboard.test.ts` (FR-008, FR-009).
- [x] T011 [US4] Сделать admin billing query совместимым со старым enum в `packages/db/src/repositories/admin-analytics.ts` и добавить `packages/db/migrations/0009_subscription_status_repair.sql` с journal entry (FR-009).
- [x] T012 [US4] Добавить mobile E2E успешной billing-метрики и безопасной ошибки в `tests/e2e/admin-dashboard.spec.ts` (SC-005).
- [x] T013 [US4] Обновить `docs/architecture.md`, `docs/api-contracts.md`, `docs/operations.md`, `docs/release-checklist.md`, `docs/product-roadmap.md`, validation и handoff; выполнить `pnpm verify:release:full` на disposable PostgreSQL (FR-009, SC-005).
