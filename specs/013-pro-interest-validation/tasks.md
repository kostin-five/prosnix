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
