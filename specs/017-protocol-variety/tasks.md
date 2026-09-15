# Задачи: разнообразная калибровка протоколов

## Phase 1: Foundational tests

- [x] T001 [P] [US1] Добавить regression баланса первых семи назначений, частоты когнитивных шагов,
      появления приседаний и сохранения ограничений в `packages/domain/tests/personalization.test.ts`
- [x] T002 [P] [US2] Добавить component regression десятисекундной блокировки воды в
      `apps/web/tests/confirm-task.test.tsx`
- [x] T003 [P] [US3] Добавить regression отсутствия технической подписи отчёта в
      `apps/web/tests/analytics-copy.test.ts`

## Phase 2: Разнообразная калибровка (US1)

- [x] T004 [US1] Заменить learning/adaptive catalog сбалансированными составами и выпустить
      protocol version 7 со стратегиями `learning-v6`, `adaptive-v7` и `fallback-v6` в
      `packages/domain/src/experiments/learning.ts`
- [x] T005 [US1] Проверить совместимость version 7 с существующей персонализацией и при
      необходимости уточнить порядок приседаний в `packages/domain/src/personalization.ts`

## Phase 3: Честное подтверждение воды (US2)

- [x] T006 [US2] Экспортировать подтверждаемое задание для component test и установить воде таймер
      10 секунд в `apps/web/src/app/App.tsx`

## Phase 4: Чистый персональный отчёт (US3)

- [x] T007 [US3] Удалить отдельную техническую строку `evidenceCount/source`, сохранив caveat и
      время обновления, в `apps/web/src/app/App.tsx`

## Phase 5: Документация и проверка

- [x] T008 Обновить пройденные блоки и затронутые regressions в
      `docs/pre-pilot-manual-test-plan.md`
- [x] T009 Обновить фактическую версию каталога в `docs/architecture.md` и записать проверку в
      `specs/017-protocol-variety/validation.md`
- [x] T010 Выполнить `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` и
      `pnpm verify:web-bundle`

## Зависимости

- T001–T003 выполняются до соответствующего кода T004–T007.
- T004 блокирует T005; US2 и US3 независимо выполняются после своих тестов.
- T008–T010 выполняются после code tasks.

## Стратегия

Сначала зафиксировать провалы тестами, затем выпустить новый versioned catalog, после этого изменить
локальный UI таймера и отчёта. Новая функция и миграция не добавляются.
