# Задачи: Telegram-напоминания о пробуждении

**Входные документы**: `/specs/002-telegram-wake-reminders/`

**Тесты**: обязательны по конституции для домена, API, хранения и критического UI-пути.

## Формат: `[ID] [P?] [Story] Описание`

- **[P]** — можно выполнять параллельно с соседними задачами после выполнения зависимостей.
- **[US1]–[US3]** — связь с пользовательской историей спецификации.

## Этап 1: Общая подготовка

- [x] T001 Добавить серверную переменную `TELEGRAM_WEB_APP_URL` в `apps/api/src/app/config.ts` и `.env.example`
- [x] T002 Добавить команду одноразовой доставки в `apps/api/package.json`
- [x] T003 [P] Проверить production boundary scanner после добавления worker через `scripts/verify-production-boundaries.mjs`

## Этап 2: Базовые компоненты

- [x] T004 [P] Добавить типы и схемы контракта расписания в `packages/contracts/src/index.ts`
- [x] T005 [P] Реализовать валидацию timezone и расчёт следующего UTC-срабатывания в `packages/domain/src/schedule/schedule.ts`
- [x] T006 [P] Написать детерминированные DST и boundary тесты в `packages/domain/tests/schedule.test.ts`
- [x] T007 Объявить порты расписания и доставки в `packages/domain/src/schedule/ports.ts` и экспортировать их из `packages/domain/src/index.ts`
- [x] T008 Добавить таблицы, enum и индексы расписаний/доставок в `packages/db/src/schema.ts`
- [x] T009 Добавить forward-only миграцию в `packages/db/migrations/0001_wake_notifications.sql` и журнал Drizzle
- [x] T010 Реализовать PostgreSQL-репозиторий расписаний и атомарное резервирование due-доставок в `packages/db/src/repositories/wake-schedules.ts`
- [x] T011 Экспортировать notification repository из `packages/db/src/repositories/index.ts`

## Этап 3: История 1 — сохранить ежедневное время (P1)

**Цель**: пользователь сохраняет, меняет, выключает и после перезагрузки видит одно расписание.

**Независимая проверка**: PUT → GET → повторный PUT возвращают одно расписание владельца с
корректным `nextTriggerAt`.

- [x] T012 [P] [US1] Написать контрактные тесты GET/PUT/валидации в `apps/api/tests/contract/schedule.test.ts`
- [x] T013 [US1] Реализовать сервис чтения/сохранения в `apps/api/src/notifications/service.ts`
- [x] T014 [US1] Реализовать авторизованные GET/PUT routes в `apps/api/src/notifications/routes.ts`
- [x] T015 [US1] Подключить репозиторий и routes в `apps/api/src/app/create-app.ts` и `apps/api/src/server.ts`
- [x] T016 [P] [US1] Добавить клиентские запросы в `apps/web/src/features/schedule/schedule-api.ts`
- [x] T017 [US1] Создать карточку настройки и предупреждение в `apps/web/src/features/schedule/wake-schedule-card.tsx`
- [x] T018 [US1] Подключить серверное расписание к bootstrap и главному экрану в `apps/web/src/app/App.tsx` и `apps/web/src/shared/api/client.ts`
- [x] T019 [US1] Добавить E2E-проверку сохранения/выключения в `tests/e2e/schedule.spec.ts`

## Этап 4: История 2 — получить сообщение и открыть протокол (P1)

**Цель**: due-срабатывание создаёт ровно одну доставку и сообщение с Web App кнопкой.

**Независимая проверка**: два параллельных запуска с одной due-записью вызывают Telegram adapter
ровно один раз и сохраняют один delivery.

- [x] T020 [P] [US2] Написать unit-тесты классификации ответов Telegram в `apps/api/tests/notifications/telegram.test.ts`
- [x] T021 [P] [US2] Написать PostgreSQL integration test параллельного claim в `apps/api/tests/integration/notification-dispatch.test.ts`
- [x] T022 [US2] Реализовать безопасный Telegram adapter в `apps/api/src/notifications/telegram.ts`
- [x] T023 [US2] Реализовать orchestration доставки и privacy-safe события в `apps/api/src/notifications/dispatch.ts`
- [x] T024 [US2] Реализовать одноразовый процесс и корректный exit code в `apps/api/src/notifications/worker.ts`
- [x] T025 [US2] Подключить реальные DB зависимости worker в `apps/api/src/notifications/run-worker.ts`

## Этап 5: История 3 — понять состояние напоминаний (P2)

**Цель**: UI различает disabled, scheduled и blocked, показывая ближайшее время и способ исправления.

**Независимая проверка**: API fixtures трёх состояний приводят к разным доступным текстам карточки.

- [x] T026 [P] [US3] Добавить component/accessibility тесты состояний карточки в `apps/web/tests/schedule-card.test.tsx`
- [x] T027 [US3] Отразить `unknown`, `available`, `blocked` и локализованное следующее срабатывание в `apps/web/src/features/schedule/wake-schedule-card.tsx`
- [x] T028 [US3] Добавить контракт статуса расписания в bootstrap repository и API response в `packages/db/src/repositories/bootstrap.ts` и `apps/api/src/app/bootstrap-route.ts`

## Этап 6: Документация и проверка

- [x] T029 [P] Обновить русские инструкции Render Cron Job и секретов в `docs/telegram-mini-app-setup.md`
- [x] T030 [P] Обновить текущий и будущий этап roadmap в `docs/release-roadmap.md`
- [x] T031 Выполнить миграцию, format, typecheck, unit/integration/E2E tests, build и production checks по `specs/002-telegram-wake-reminders/quickstart.md`

## Зависимости и порядок

- Этап 2 зависит от T001–T003 и блокирует пользовательские истории.
- US1 зависит от T004–T011 и даёт самостоятельно работающую серверную настройку.
- US2 зависит от T005, T007–T011 и может выполняться независимо от UI после foundation.
- US3 зависит от US1 и результата доставки US2.
- Этап 6 выполняется после выбранных пользовательских историй.

## Стратегия реализации

MVP включает US1 и US2: одно расписание и at-most-once Telegram-доставка. US3 добавляет прозрачное
состояние пользователю и входит в тот же релиз, если все автоматические проверки проходят.
