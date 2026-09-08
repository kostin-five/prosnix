# Задачи: адаптивное обучение протоколам

## Phase 1: Setup

- [x] T001 Зафиксировать versioned решения и проверяемые fixtures в `specs/014-adaptive-protocol-learning/research.md` и `specs/014-adaptive-protocol-learning/quickstart.md`

## Phase 2: Foundational

- [x] T002 [P] Добавить adaptive evidence и comparison progress types в `packages/domain/src/model.ts`
- [x] T003 [P] Добавить second-session pilot aggregate в `packages/domain/src/ports.ts` и `packages/contracts/src/index.ts`

## Phase 3: User Story 1 — адаптивный протокол (P1)

**Цель**: выбирать лучший наблюдаемый допустимый вариант, сохраняя исследование альтернатив и не повторяя exact sequence подряд.

**Независимая проверка**: один deterministic fixture покрывает exploration, verification, context isolation, budget/profile filtering и единственный fallback.

- [x] T004 [US1] Написать failing deterministic selector tests в `packages/domain/tests/experiments.test.ts` и `packages/domain/tests/personalization.test.ts`
- [x] T005 [US1] Реализовать versioned candidate catalog и adaptive ranking в `packages/domain/src/experiments/learning.ts`
- [x] T006 [US1] Схлопывать одинаковые personalized sequences и сохранять exact-repeat guard в `packages/domain/src/personalization.ts`
- [x] T007 [US1] Загрузить canonical comparable evidence и подключить selector в `packages/db/src/repositories/sessions.ts`
- [x] T008 [US1] Добавить PostgreSQL integration regression назначения в `apps/api/tests/integration/wake-personalization.test.ts`

## Phase 4: User Story 2 — содержательный профиль (P1)

**Цель**: показывать полезный общий профиль после семи сессий независимо от готовности factor effect.

**Независимая проверка**: fixture из 13 сессий без трёх factor pairs возвращает общие метрики, best sequence и точный progress.

- [x] T009 [US2] Написать analytics-v2 и comparison progress tests в `packages/domain/tests/analytics.test.ts` и `packages/domain/tests/analytics-fixtures.test.ts`
- [x] T010 [US2] Реализовать analytics-v2 comparison progress в `packages/domain/src/analytics/profile.ts` и `packages/domain/src/model.ts`
- [x] T011 [US2] Передать context/duration evidence и сохранить analytics-v2 projections в `packages/db/src/repositories/analytics.ts`
- [x] T012 [US2] Обновить analytics client и содержательную карточку профиля в `apps/web/src/shared/api/client.ts` и `apps/web/src/app/App.tsx`
- [x] T013 [US2] Добавить component regressions профиля в `apps/web/tests/wake-profile-summary.test.tsx`

## Phase 5: User Story 3 — пилотный возврат (P2)

**Цель**: отдельно измерять вторую completed session в течение семи суток после первой без изменения D1/D7.

**Независимая проверка**: ручной temporal fixture совпадает с cohort/eligible/returned/pending/rate ответа admin.

- [x] T014 [US3] Написать PostgreSQL fixture границ семи суток в `apps/api/tests/integration/admin-dashboard.test.ts`
- [x] T015 [US3] Реализовать second-session aggregate в `packages/db/src/repositories/admin-analytics.ts`
- [x] T016 [US3] Добавить rate в API и contract regression в `apps/api/src/admin/routes.ts` и `apps/api/tests/contract/admin-growth.test.ts`
- [x] T017 [US3] Показать пилотную метрику и pending cohort в `apps/web/src/features/admin/admin-screen.tsx` и `apps/web/tests/admin-dashboard.test.tsx`

## Phase 6: User Story 4 — иконки и анимация заданий (P2)

**Цель**: сделать задания визуально цельными и ясно показать работу таймера без потери доступности.

**Независимая проверка**: все task IDs отображают векторную пиктограмму, timed task имеет motion и статичный reduced-motion режим.

- [x] T018 [US4] Создать единое отображение task icons в `apps/web/src/features/tasks/task-icon.tsx`
- [x] T019 [US4] Добавить тематический timer visual и reduced-motion поведение в `apps/web/src/features/tasks/task-timer-visual.tsx` и `apps/web/src/app/App.tsx`
- [x] T020 [US4] Добавить component regressions иконок и timer state в `apps/web/tests/task-engine.test.ts` и `apps/web/tests/accessibility.test.tsx`

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T021 [P] Обновить mobile E2E для профиля, task visuals и admin pilot metric в `tests/e2e/analytics.spec.ts`, `tests/e2e/wake-session.spec.ts` и `tests/e2e/admin-dashboard.spec.ts`
- [x] T022 Обновить фактические документы в `docs/architecture.md`, `docs/api-contracts.md`, `docs/product-roadmap.md`, `docs/testing.md` и `docs/release-checklist.md`
- [x] T023 Выполнить проверки из `specs/014-adaptive-protocol-learning/quickstart.md` и записать результат в `specs/014-adaptive-protocol-learning/validation.md`
- [x] T024 Создать датированный handoff в `docs/handoffs/` и обновить `docs/handoffs/CURRENT.md`

## Dependencies

- Phase 2 блокирует все пользовательские истории.
- US1 и US2 используют один canonical evidence shape; US1 завершается до repository wiring US2.
- US3 независима от selector и может проверяться после foundational contracts.
- Phase 6 выполняется после US1–US3.

## Parallel opportunities

- T002 и T003 затрагивают независимые contracts.
- После T003 задачи US3 не зависят от UI профиля US2.
- T018 можно готовить параллельно с документацией T019 после стабилизации contracts.

## Implementation strategy

MVP — US1 и US2: исправленный выбор и честный профиль непосредственно решают пользовательский дефект.
US3 закрывает измеримость пилота тем же release candidate. Каждый этап остаётся отдельно тестируемым,
но feature выпускается только после полного набора и release gate.
