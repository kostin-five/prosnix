# Задачи: честные задания и длительность протокола

## Phase 1: Setup

- [x] T001 Зафиксировать versioned policy целей и обратную совместимость в `packages/domain/src/task-policy.ts`

## Phase 2: Foundational tests

- [x] T002 [P] Добавить domain regressions целей, server rejection и старых протоколов в `packages/domain/tests/task-policy.test.ts` и `packages/domain/tests/session.test.ts`
- [x] T003 [P] Добавить component regressions реакции, внимания, памяти и 10-минутной нагрузки в `apps/web/tests/cognitive-tasks.test.tsx`
- [x] T004 [P] Добавить HTTP contract regression недостаточного результата в `apps/api/tests/contract/sessions.test.ts`
- [x] T005 [P] Расширить mobile critical-flow regression в `tests/e2e/wake-personalization.spec.ts`

## Phase 3: Честная реакция (US1)

- [x] T006 [US1] Заблокировать преждевременные и повторные реакции в `apps/web/src/app/App.tsx`
- [x] T007 [US1] Проверять результат protocol version 3 в `packages/domain/src/session/session.ts`

## Phase 4: Честные внимание и память (US2)

- [x] T008 [US2] Завершать внимание только по целевому числу правильных ответов в `apps/web/src/app/App.tsx`
- [x] T009 [US2] Повторять память с новой последовательностью до целевого числа правильных раундов в `apps/web/src/app/App.tsx`

## Phase 5: Нагрузка 10 минут (US3)

- [x] T010 [US3] Передавать бюджет в task components и увеличить цели математики, внимания, реакции и памяти в `apps/web/src/app/App.tsx`
- [x] T011 [US3] Увеличить безопасные timed intervals режима 10 минут в `apps/web/src/app/App.tsx`
- [x] T012 [US3] Обновить оценочную нагрузку бюджета в `packages/domain/src/personalization.ts`
- [x] T013 [US3] Выпустить новые protocol/strategy versions в `packages/domain/src/experiments/learning.ts`

## Phase 6: Роль контекста (US4)

- [x] T014 [US4] Объяснить независимое обучение по контексту в `apps/web/src/features/personalization/wake-context-sheet.tsx`
- [x] T015 [US4] Проверить isolation evidence и допустимое совпадение стартовых назначений в `packages/domain/tests/personalization.test.ts`

## Phase 7: Polish и validation

- [x] T016 Обновить `docs/architecture.md`, `docs/api-contracts.md`, `docs/testing.md`, `docs/release-checklist.md` и `docs/product-roadmap.md`
- [x] T017 Выполнить `pnpm verify:release`, mobile E2E и полный gate на disposable PostgreSQL; записать результат в `specs/016-task-integrity-duration/validation.md`
- [x] T018 Создать датированный handoff и обновить `docs/handoffs/CURRENT.md`

## Phase 8: Pilot feedback hardening

- [x] T019 Добавить domain regressions семи уникальных шагов, ограниченного профиля и разминки перед
      приседаниями в `packages/domain/tests/personalization.test.ts`
- [x] T020 Выпустить protocol version 4 и новые strategy versions в
      `packages/domain/src/experiments/learning.ts`
- [x] T021 Дополнять 10-минутное назначение до семи уникальных разрешённых заданий и нормализовать
      положение приседаний в `packages/domain/src/personalization.ts`
- [x] T022 Добавить single-flight guard результата, проверку текущего task ID и восстановление после
      canonical conflict в `apps/web/src/app/App.tsx`
- [x] T023 Добавить web regression повторного callback и canonical recovery в
      `apps/web/tests/task-submission.test.ts`
- [x] T024 Обновить architecture, roadmap, ручной test plan, validation и handoff по фактическому
      поведению; выполнить полный release gate на disposable PostgreSQL

## Зависимости

- T001 блокирует T002, T009–T013.
- T002–T005 выполняются до соответствующей реализации.
- US1 и US2 можно проверить независимо; US3 использует общую policy после T001.
- US4 не меняет формулу назначения и может выполняться независимо от US1–US3.
- T016–T018 выполняются после всех code tasks.

## Стратегия

Сначала закрыть обход заданий как P1, затем увеличить нагрузку 10 минут, после этого уточнить UX
контекста. На каждом шаге приложение остаётся запускаемым; migration и новые зависимости не нужны.

## Phase 9: Единое световое задание (US7)

- [x] T025 [P] [US7] Добавить domain regressions отсутствия `curtains`, единственного светового шага
      и семи уникальных заданий в `packages/domain/tests/personalization.test.ts`
- [x] T026 [P] [US7] Добавить web regression единого пункта анкеты при сохранении legacy icon в
      `apps/web/tests/personalization.test.tsx` и `apps/web/tests/accessibility.test.tsx`
- [x] T027 [US7] Исключить `curtains` из новых candidates и selectable pool, выпустить protocol
      version 5 и новые strategy versions в `packages/domain/src/experiments/learning.ts` и
      `packages/domain/src/personalization.ts`
- [x] T028 [US7] Переименовать `window` в «Яркий свет», объединить безопасные инструкции и убрать
      отдельное исключение «Шторы» в `apps/web/src/app/App.tsx` и
      `apps/web/src/features/personalization/capability-profile-card.tsx`
- [x] T029 [US7] Обновить ручной предпилотный тест-план до v3 и синхронизировать architecture,
      roadmap, testing, release checklist, validation и handoff в `docs/` и `specs/016-task-integrity-duration/`
- [x] T030 [US7] Выполнить `pnpm verify:release` и полный gate на disposable PostgreSQL; проверить
      старую сессию с `curtains` и новое семишаговое назначение

## Phase 10: Регрессии пилотной калибровки

- [x] T031 Добавить domain regression семи разных первых фактических последовательностей для
      полного и двигательного профиля.
- [x] T032 Заменить схлопывающиеся learning-кандидаты разными порядками и выпустить protocol version
      6 со стратегиями `learning-v5`, `adaptive-v6` и `fallback-v5`.
- [x] T033 Засчитывать только реакцию быстрее 500 мс, показывать медленную попытку и добавить
      component regression граничных 500/499 мс.
- [x] T034 Обновить эксплуатационную документацию, ручной тест-план и handoff для protocol version
      6 и контентных рабочих чатов.
- [ ] T035 Выполнить полный release gate на disposable PostgreSQL, получить зелёный CI и проверить
      API/Static Site production deploy одного точного SHA.
