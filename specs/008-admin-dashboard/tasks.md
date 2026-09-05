# Задачи: Продуктовая админ-панель

**Ввод**: документы из `specs/008-admin-dashboard/`

**Тесты**: обязательны для формул, доступа, API-контракта, UI-состояний и мобильного сценария.

## Фаза 1: Подготовка

- [x] T001 Зафиксировать расширенный агрегированный контракт в `packages/contracts/src/index.ts`
- [x] T002 Обновить domain summary и repository port в `packages/domain/src/ports.ts`

## Фаза 2: Общий фундамент

- [x] T003 [P] Добавить контрольные contract fixtures в `apps/api/tests/contract/admin-growth.test.ts`
- [x] T004 [P] Добавить PostgreSQL fixture для когорт, оценок, разбивок и функций в `apps/api/tests/integration/admin-dashboard.test.ts`
- [x] T005 [P] Подготовить component fixtures и UI-тесты в `apps/web/tests/admin-dashboard.test.tsx`

## Фаза 3: История 1 — Когортная воронка (P1)

**Цель**: владелец видит согласованную воронку выбранного периода.

**Независимый тест**: контрольные sessions дают ожидаемые assigned/started/completed/followedUp и rates; пользователь вне allowlist получает 404.

- [x] T006 [US1] Реализовать когортные SQL-агрегаты в `packages/db/src/repositories/admin-analytics.ts`
- [x] T007 [US1] Расширить rate calculations и безопасный ответ в `apps/api/src/admin/routes.ts`
- [x] T008 [US1] Реализовать блок воронки и переключение периода в `apps/web/src/features/admin/admin-screen.tsx`
- [x] T009 [US1] Завершить contract и component тесты истории 1 в `apps/api/tests/contract/admin-growth.test.ts` и `apps/web/tests/admin-dashboard.test.tsx`

## Фаза 4: История 2 — Качество пробуждений (P2)

**Цель**: владелец видит честный парный эффект и follow-up с размером выборки.

**Независимый тест**: непарные ratings исключены, delta и outcome rates совпадают с fixture.

- [x] T010 [US2] Добавить SQL парных ratings и breakdowns в `packages/db/src/repositories/admin-analytics.ts`
- [x] T011 [US2] Добавить UI качества, контекстов и длительности в `apps/web/src/features/admin/admin-screen.tsx`
- [x] T012 [US2] Проверить формулы и пояснения в `apps/api/tests/integration/admin-dashboard.test.ts` и `apps/web/tests/admin-dashboard.test.tsx`

## Фаза 5: История 3 — Удержание и эксплуатация (P3)

**Цель**: владелец видит timeline, retention, использование функций и качество доставок.

**Независимый тест**: timeline включает нулевые дни, feature counts и delivery rate совпадают с fixture.

- [x] T013 [US3] Реализовать timeline, feature и delivery aggregates в `packages/db/src/repositories/admin-analytics.ts`
- [x] T014 [US3] Добавить динамику, feature adoption, delivery и billing UI в `apps/web/src/features/admin/admin-screen.tsx`
- [x] T015 [US3] Добавить loading, empty, error и retry состояния в `apps/web/src/features/admin/admin-screen.tsx`
- [x] T016 [US3] Завершить integration/component тесты истории 3 в `apps/api/tests/integration/admin-dashboard.test.ts` и `apps/web/tests/admin-dashboard.test.tsx`

## Фаза 6: Завершение

- [x] T017 [P] Добавить owner-only mobile E2E в `tests/e2e/admin-dashboard.spec.ts`
- [x] T018 [P] Обновить API и архитектуру в `docs/api-contracts.md` и `docs/architecture.md`
- [x] T019 [P] Обновить roadmap и новый handoff в `docs/product-roadmap.md` и `docs/handoffs/`
- [x] T020 Запустить полный release verification и записать результаты в `specs/008-admin-dashboard/validation.md`
- [x] T021 Выполнить Spec Kit converge и закрыть найденные расхождения в `specs/008-admin-dashboard/tasks.md`

## Зависимости

- T001–T005 блокируют реализацию пользовательских историй.
- US1 является MVP и задаёт согласованную когорту для US2/US3.
- US2 и US3 используют тот же summary contract и выполняются после US1.
- T017–T021 выполняются после всех пользовательских историй.

## Стратегия реализации

1. Сначала типы и тестовые данные.
2. Затем когортная воронка как независимо полезный MVP.
3. После неё качество пробуждения и эксплуатационные показатели.
4. В конце mobile E2E, документация, полный validation и converge.
