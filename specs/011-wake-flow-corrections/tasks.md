# Задачи: Понятное пробуждение и персональные результаты

## Phase 1: Подготовка

- [x] T001 Зафиксировать regression fixtures для 1/6/8 completed sessions в `packages/domain/tests/analytics.test.ts`

## Phase 2: Основа

- [x] T002 Обновить вычисление protocol effects и profile progress в `packages/domain/src/analytics/profile.ts`
- [x] T003 [P] Обновить contract expectations analytics в `apps/api/tests/contract/analytics.test.ts`

## Phase 3: История 1 — Честный личный результат

- [x] T004 [US1] Показать готовность общего профиля и предварительного лидера в `apps/web/src/app/App.tsx`
- [x] T005 [US1] Убрать daily trend card из статистики в `apps/web/src/app/App.tsx`
- [x] T006 [US1] Добавить regression для профиля и лидера в `tests/e2e/analytics.spec.ts`

## Phase 4: История 2 — Актуальный AI-отчёт

- [x] T007 [US2] Invalidate analytics/history после post-rating в `apps/web/src/app/App.tsx`
- [x] T008 [US2] Показать fallback AI как базовый расчёт в `apps/web/src/app/App.tsx`
- [x] T009 [US2] Добавить regression AI после новой сессии в `apps/api/tests/coach/service.test.ts`

## Phase 5: История 3 — Полезный протокол

- [x] T010 [US3] Выбирать неповторяющийся learning assignment в `packages/domain/src/experiments/learning.ts`
- [x] T011 [US3] Дополнять короткие планы допустимыми активными шагами в `packages/domain/src/personalization.ts`
- [x] T012 [US3] Передавать предыдущее назначение в server selection в `packages/db/src/repositories/sessions.ts`
- [x] T013 [US3] Добавить domain и integration regressions для бюджета и повтора в `packages/domain/tests/personalization.test.ts` и `apps/api/tests/integration/wake-personalization.test.ts`

## Phase 6: История 4 — Компактная статистика

- [x] T014 [US4] Ограничить историю пятью строками и добавить раскрытие в `apps/web/src/app/App.tsx`
- [x] T015 [US4] Сделать routine collapsible в `apps/web/src/features/personalization/wake-routine-card.tsx`
- [x] T016 [US4] Оставить Beta только на home в `apps/web/src/app/App.tsx` и `apps/web/src/features/settings/settings-screen.tsx`
- [x] T017 [US4] Добавить component/E2E regressions compact history, routine и Beta в `apps/web/tests/personalization.test.tsx`, `apps/web/tests/production-growth.test.tsx` и `tests/e2e/analytics.spec.ts`

## Phase 7: Проверка и документация

- [x] T018 Обновить реализованное поведение в `docs/api-contracts.md`, `docs/architecture.md` и `docs/product-roadmap.md`
- [x] T019 Добавить mobile regression сценарии в `tests/e2e/wake-session.spec.ts` и `tests/e2e/analytics.spec.ts`
- [x] T020 Запустить targeted tests, format, typecheck, build и записать результат в `specs/011-wake-flow-corrections/validation.md`

## Зависимости

`T001 → T002 → T004–T009`; `T010–T013` после T002; `T014–T017` независимы от server tasks. T018–T020 после всех пользовательских историй.
