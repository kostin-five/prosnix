# Задачи: Follow-up и эксплуатационная надёжность

**Входные документы**: `/specs/003-follow-up-operations/`

**Тесты**: обязательны по конституции для доставки, конкурентного хранения, служебного контракта и
очистки.

## Формат: `[ID] [P?] [Story] Описание`

- **[P]** — можно выполнять параллельно после зависимостей.
- **[US1]–[US3]** — связь с пользовательской историей.

## Этап 1: Общая подготовка

- [x] T001 Проверить ignore-файлы и production boundary для новых серверных файлов в `.gitignore`, `.dockerignore`, `.prettierignore` и `scripts/verify-production-boundaries.mjs`
- [x] T002 [P] Зафиксировать Spec Kit документы функции в `specs/003-follow-up-operations/`

## Этап 2: Базовые компоненты

- [x] T003 Обновить claim batch, follow-up и maintenance порты в `packages/domain/src/schedule/ports.ts`
- [x] T004 Добавить таблицу follow-up delivery и индексы в `packages/db/src/schema.ts`
- [x] T005 Добавить forward-only миграцию в `packages/db/migrations/0002_follow_up_notifications.sql` и `packages/db/migrations/meta/_journal.json`
- [x] T006 Обновить wake claim для skipped/maxLag summary в `packages/db/src/repositories/wake-schedules.ts`

## Этап 3: История 1 — своевременный follow-up (P1)

**Цель**: завершённая сессия без ответа создаёт одно сообщение после 15 минут.

**Независимая проверка**: due сессия отправляется один раз; ответившая, просроченная и повторно
обработанная сессии не отправляются.

- [x] T007 [P] [US1] Написать unit-тесты текста и kind Telegram сообщения в `apps/api/tests/notifications/telegram.test.ts`
- [x] T008 [P] [US1] Написать orchestration-тесты follow-up, гонки ответа и независимых ошибок в `apps/api/tests/notifications/follow-up-dispatch.test.ts`
- [x] T009 [P] [US1] Написать PostgreSQL integration-тест атомарного claim и дедупликации в `apps/api/tests/integration/follow-up-notification.test.ts`
- [x] T010 [US1] Реализовать `PostgresFollowUpNotificationRepository` в `packages/db/src/repositories/follow-up-notifications.ts`
- [x] T011 [US1] Экспортировать follow-up repository в `packages/db/src/repositories/index.ts`
- [x] T012 [US1] Добавить `kind` и follow-up сообщение в `apps/api/src/notifications/telegram.ts`
- [x] T013 [US1] Реализовать orchestration в `apps/api/src/notifications/follow-up-dispatch.ts`

## Этап 4: История 2 — privacy-safe сводка (P2)

**Цель**: защищённый endpoint обрабатывает оба типа и возвращает агрегированную сводку.

**Независимая проверка**: авторизованный POST возвращает wake/followUp/total без идентификаторов;
пересекающийся run получает 409.

- [x] T014 [P] [US2] Расширить контрактные тесты endpoint и overlap в `apps/api/tests/contract/notification-dispatch.test.ts`
- [x] T015 [P] [US2] Расширить dispatch summary тесты в `apps/api/tests/notifications/dispatch.test.ts`
- [x] T016 [US2] Реализовать сводную обработку и in-process lock в `apps/api/src/notifications/dispatch-route.ts`
- [x] T017 [US2] Подключить новые зависимости в `apps/api/src/app/create-app.ts` и `apps/api/src/server.ts`

## Этап 5: История 3 — 90-дневное хранение (P2)

**Цель**: каждый служебный run удаляет только устаревшие delivery logs.

**Независимая проверка**: старые wake/follow-up deliveries удаляются, свежие и observations
остаются; повтор возвращает нули.

- [x] T018 [P] [US3] Добавить PostgreSQL integration-тест cleanup в `apps/api/tests/integration/notification-retention.test.ts`
- [x] T019 [US3] Реализовать maintenance repository в `packages/db/src/repositories/notification-maintenance.ts`
- [x] T020 [US3] Подключить cleanup и счётчики к `apps/api/src/notifications/dispatch-route.ts`
- [x] T021 [US3] Обновить политику хранения в `apps/web/src/features/legal/privacy-policy.tsx`

## Этап 6: Документация и проверка

- [x] T022 [P] Обновить русские roadmap и cron инструкции в `docs/release-roadmap.md` и `docs/telegram-mini-app-setup.md`
- [x] T023 Выполнить миграцию, format, typecheck, unit/integration/E2E, build и production checks по `specs/003-follow-up-operations/quickstart.md`
- [x] T024 Зафиксировать результаты и ограничения staging в `specs/003-follow-up-operations/validation.md`

## Зависимости и порядок

- Этап 2 зависит от T001–T002 и блокирует истории.
- US1 зависит от T003–T006.
- US2 зависит от готового US1 orchestration.
- US3 зависит от схемы Этапа 2, но независимо тестируется от Telegram.
- Этап 6 выполняется после всех историй.

## Параллельные возможности

- T007–T009 пишутся в разных тестовых границах.
- T014 и T015 независимы до реализации route.
- T018 можно подготовить параллельно с контрактными тестами US2.
- T021 и T022 не затрагивают серверную реализацию.

## Стратегия реализации

MVP функции — US1: одно follow-up сообщение без дубля. US2 и US3 обязательны в том же release,
поскольку закрывают наблюдаемость и правило хранения, требуемые конституцией.
