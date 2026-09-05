# Задачи: Персонализация пробуждения

**Вводные**: документы из `specs/007-wake-personalization/`
**Проверки**: обязательны domain, contract, integration, web accessibility и E2E сценарии.

## Фаза 1. Общая основа

- [x] T001 [P] Добавить общие типы и TypeBox-схемы профиля, контекста, рутины и создания сессии в `packages/contracts/src/index.ts`
- [x] T002 [P] Расширить доменную модель и порты персонализации в `packages/domain/src/model.ts` и `packages/domain/src/ports.ts`
- [x] T003 [P] Реализовать детерминированный фильтр допустимых протоколов и временного бюджета в `packages/domain/src/personalization.ts`
- [x] T004 [P] Написать сначала падающие unit-тесты фильтра, fallback и границ бюджета в `packages/domain/tests/personalization.test.ts`

## Фаза 2. Хранение и серверные границы

- [x] T005 Создать forward-only миграцию `packages/db/migrations/0005_wake_personalization.sql`
- [x] T006 Обновить Drizzle-схему профиля, контекста сессии и рутины в `packages/db/src/schema.ts`
- [x] T007 Реализовать репозиторий профиля, рутины и прогресса с ownership, revision и idempotency в `packages/db/src/repositories/personalization.ts`
- [x] T008 Подключить новые экспорты репозитория в `packages/db/src/repositories/index.ts` и `packages/db/src/index.ts`
- [x] T009 Сначала добавить contract-тесты auth, validation, concurrency и idempotency в `apps/api/tests/contract/personalization.test.ts`
- [x] T010 Реализовать authenticated API профиля, рутины и прогресса в `apps/api/src/personalization/routes.ts`
- [x] T011 Подключить зависимости и маршруты в `apps/api/src/app/create-app.ts` и `apps/api/src/server.ts`

## Фаза 3. История 1 — Подходящий протокол (P1)

**Цель**: назначать допустимый протокол по контексту и бюджету с неизменяемым снимком.

**Независимая проверка**: исключённые задания не назначаются, контекст и бюджет переживают перезапуск.

- [x] T012 [US1] Сначала расширить тесты создания/возобновления сессии в `apps/api/tests/contract/sessions.test.ts` и `apps/api/tests/integration/wake-personalization.test.ts`
- [x] T013 [US1] Расширить команду создания и WakeSession контекстом, бюджетом и снимком в `packages/domain/src/model.ts` и `packages/domain/src/ports.ts`
- [x] T014 [US1] Применить профиль и фильтр при назначении, сохранить снимок и загрузить его в `packages/db/src/repositories/sessions.ts` и `packages/db/src/repositories/bootstrap.ts`
- [x] T015 [US1] Вернуть контекст и бюджет в истории через `packages/db/src/repositories/session-history.ts`, `apps/api/src/sessions/history-routes.ts` и общие контракты
- [x] T016 [US1] Исключить несопоставимые контексты из протокольных сравнений в `packages/db/src/repositories/analytics.ts` и покрыть регрессией
- [x] T017 [US1] Добавить клиентский API и форму выбора контекста/бюджета в `apps/web/src/features/personalization/personalization-api.ts` и `apps/web/src/features/personalization/wake-context-sheet.tsx`
- [x] T018 [US1] Встроить анкету, выбор контекста, запуск и отображение истории в `apps/web/src/app/App.tsx` и `apps/web/src/shared/api/client.ts`

## Фаза 4. История 2 — Личная рутина (P2)

**Цель**: управлять отдельной рутиной и сохранять её прогресс после измерений.

**Независимая проверка**: рутина восстанавливается, а аналитика не меняется.

- [x] T019 [US2] Сначала добавить API/integration тесты снимка и независимости аналитики в `apps/api/tests/integration/wake-personalization.test.ts`
- [x] T020 [US2] Реализовать клиентский редактор профиля и рутины в `apps/web/src/features/personalization/capability-profile-card.tsx` и `apps/web/src/features/personalization/wake-routine-card.tsx`
- [x] T021 [US2] Подключить редакторы к `apps/web/src/features/settings/settings-screen.tsx` и bootstrap-данным
- [x] T022 [US2] Добавить отдельный необязательный чек-лист после результата и серверное восстановление в `apps/web/src/app/App.tsx`
- [x] T023 [US2] Написать web-тесты редактирования и рутины в `apps/web/tests/personalization.test.tsx`

## Фаза 5. История 3 — Солнечная тема (P3)

**Цель**: единая жёлто-оранжевая палитра без потери доступности.

**Независимая проверка**: новые сценарии доступны на ширине 320 px и смысл статусов не зависит от цвета.

- [x] T024 [US3] Обновить семантические токены и focus/error/success состояния в `apps/web/src/styles/theme.css`
- [x] T025 [US3] Убрать несогласованные фиолетовые акценты новых и основных экранов в `apps/web/src/app/App.tsx` и feature-компонентах
- [x] T026 [US3] Расширить accessibility-тесты мобильных форм в `apps/web/tests/accessibility.test.tsx`

## Фаза 6. Проверка и документация

- [x] T027 [P] Добавить мобильный E2E smoke профиля, контекста и рутины в `tests/e2e/wake-personalization.spec.ts`
- [x] T028 Обновить фактическую архитектуру, roadmap и юридическое описание данных в `docs/architecture.md`, `docs/product-roadmap.md` и публичной политике
- [x] T029 Обновить датированный handoff и `docs/handoffs/CURRENT.md` после фактической реализации
- [x] T030 Выполнить `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm verify:web-bundle`, `pnpm verify:production` и зафиксировать результат в `specs/007-wake-personalization/validation.md`

## Зависимости и порядок

- T001–T004 формируют общую основу; T004 пишется до T003.
- T005–T011 зависят от общей основы и блокируют серверные пользовательские истории.
- История 1 (T012–T018) обязательна для MVP и выполняется до истории 2.
- История 2 (T019–T023) использует завершённую сессию истории 1, но не входит в аналитику.
- История 3 может выполняться после появления новых компонентов.
- Фаза проверки начинается после всех выбранных историй.
- Миграция production, push и deploy в список реализации не входят и требуют отдельного решения владельца.

## Стратегия реализации

Сначала доводится вертикальный P1-срез: профиль, контекст, назначение, история и корректная аналитика. Затем добавляется независимая рутина, после неё визуальная тема и полная проверка. Старые сессии остаются читаемыми как `unspecified`, а новые функции деградируют к безопасному протоколу при отсутствии персональных данных.
