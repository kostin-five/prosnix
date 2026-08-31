# Задачи: Надёжный UX и AI Wake Coach

**Входные документы**: `specs/004-product-polish-ai/`

**Тесты**: обязательны по конституции для session state, snooze, AI trust boundary, history и UI.

## Этап 1: Подготовка

- [x] T001 Проверить production boundary, ignore-файлы и текущую конфигурацию секретов в `.gitignore`, `.dockerignore`, `.prettierignore`, `.env.example` и `scripts/verify-production-boundaries.mjs`
- [x] T002 [P] Зафиксировать Spec Kit документы в `specs/004-product-polish-ai/`

## Этап 2: Общие контракты и хранение

- [x] T003 Добавить coach/history контракты и доменные порты в `packages/contracts/src/index.ts` и `packages/domain/src/ports.ts`
- [x] T004 Добавить `coach_insights` в `packages/db/src/schema.ts`
- [x] T005 Добавить forward-only миграцию в `packages/db/migrations/0003_ai_coach_cache.sql` и `packages/db/migrations/meta/_journal.json`
- [x] T006 Реализовать cache/history repositories в `packages/db/src/repositories/coach-insights.ts`, `packages/db/src/repositories/session-history.ts` и экспортировать их

## Этап 3: История 1 — надёжный restart (P1)

**Независимая проверка**: abandon POST принимается без body и переводит сессию в abandoned.

- [x] T007 [P] [US1] Добавить regression contract/E2E тест пустого abandon POST в `apps/api/tests/contract/sessions.test.ts` и `tests/e2e/resume.spec.ts`
- [x] T008 [US1] Исправить формирование no-body запросов и человекочитаемые API errors в `apps/web/src/features/session/session-api.ts`

## Этап 4: История 2 — AI Wake Coach (P1)

**Независимая проверка**: insufficient не вызывает provider; ready валидируется и кэшируется;
invalid/timeout даёт unavailable; внешний payload не содержит ID.

- [x] T009 [P] [US2] Добавить config-тесты DeepSeek в `apps/api/tests/app/config.test.ts`
- [x] T010 [P] [US2] Написать adapter-тесты payload, JSON validation и timeout в `apps/api/tests/coach/deepseek.test.ts`
- [x] T011 [P] [US2] Написать service/contract тесты insufficient, cache и fallback в `apps/api/tests/coach/service.test.ts` и `apps/api/tests/contract/coach.test.ts`
- [x] T012 [US2] Расширить `AppConfig` безопасной optional DeepSeek конфигурацией в `apps/api/src/app/config.ts`
- [x] T013 [US2] Реализовать DeepSeek gateway и runtime validation в `apps/api/src/coach/deepseek.ts`
- [x] T014 [US2] Реализовать fingerprint, cache orchestration и fallback в `apps/api/src/coach/service.ts`
- [x] T015 [US2] Добавить authenticated endpoint и wiring в `apps/api/src/coach/routes.ts`, `apps/api/src/app/create-app.ts`, `apps/api/src/server.ts`
- [x] T016 [US2] Добавить client hook и AI карточку в `apps/web/src/features/coach/use-coach-insight.ts`, `apps/web/src/shared/api/client.ts`, `apps/web/src/app/App.tsx`

## Этап 5: История 3 — отдельные настройки (P2)

**Независимая проверка**: третья вкладка содержит schedule/privacy/delete; Stats их больше не содержит.

- [x] T017 [P] [US3] Покрыть mobile E2E навигацию настроек в `tests/e2e/schedule.spec.ts` и `tests/e2e/delete-profile.spec.ts`
- [x] T018 [US3] Создать экран Settings и перенести schedule/privacy/delete в `apps/web/src/features/settings/settings-screen.tsx` и `apps/web/src/app/App.tsx`
- [x] T019 [US3] Обновить фактическое описание DeepSeek и размещение политики в `apps/web/src/features/legal/privacy-policy.tsx`

## Этап 6: История 4 — серверный snooze (P2)

**Независимая проверка**: nextTriggerAt переносится на 5 минут, localTime неизменен, disabled даёт 409.

- [x] T020 [P] [US4] Добавить contract и mobile E2E тесты snooze в `apps/api/tests/contract/schedule.test.ts` и `tests/e2e/snooze.spec.ts`
- [x] T021 [US4] Добавить snooze operation в `packages/domain/src/schedule/ports.ts`, `packages/db/src/repositories/wake-schedules.ts`, `apps/api/src/notifications/service.ts`, `apps/api/src/notifications/routes.ts`
- [x] T022 [US4] Подключить snooze API и рабочую кнопку с обратной связью в `apps/web/src/features/schedule/schedule-api.ts` и `apps/web/src/app/App.tsx`

## Этап 7: История 5 — понятная аналитика и история (P2)

**Независимая проверка**: endpoint изолирует владельца, UI показывает реальные записи и не показывает UUID.

- [x] T023 [P] [US5] Добавить history contract и E2E источников без UUID в `apps/api/tests/contract/history.test.ts` и `tests/e2e/analytics.spec.ts`
- [x] T024 [US5] Добавить authenticated history endpoint и wiring в `apps/api/src/sessions/history-routes.ts`, `apps/api/src/app/create-app.ts`, `apps/api/src/server.ts`
- [x] T025 [US5] Добавить history hook и понятный блок «Как считается» в `apps/web/src/features/history/use-session-history.ts`, `apps/web/src/shared/api/client.ts`, `apps/web/src/app/App.tsx`

## Этап 8: Завершение

- [x] T026 [P] Обновить `.env.example`, русские инструкции и roadmap в `.env.example`, `docs/telegram-mini-app-setup.md`, `docs/release-roadmap.md`
- [x] T027 Выполнить миграцию, format, typecheck, unit/integration/E2E, build и production checks по `specs/004-product-polish-ai/quickstart.md`
- [x] T028 Зафиксировать результаты и оставшийся staging smoke-test в `specs/004-product-polish-ai/validation.md`

## Зависимости

- Этап 2 блокирует AI и history.
- US1 не зависит от новой схемы и исправляется первой.
- US2 зависит от T003–T006.
- US3 независима после общих контрактов, но изменения `App.tsx` выполняются после US2.
- US4 использует существующее расписание и выполняется после Settings, чтобы UI имел одно место владения.
- US5 зависит от history repository из T006.

## Стратегия реализации

Сначала устранить блокирующий 400, затем безопасно включить AI, после чего завершить UX-навигацию,
snooze и историю. Каждая state/data граница получает тест до реализации; релиз выполняется одним
совместимым миграционным коммитом.

## Этап 9: Convergence

- [x] T029 Реализовать содержательный детерминированный AI fallback для недостаточной выборки и сбоя провайдера по FR-006 (partial)
- [x] T030 Явно показывать уровень уверенности в AI-карточке по US2/AC1 (partial)
- [x] T031 Использовать канонические серверные агрегаты и историю для счётчиков, графика и средней длительности после повторного открытия по Constitution II (contradicts)
- [x] T032 Добавить PostgreSQL integration-тесты изоляции history, cache cascade и сохранения snooze без изменения localTime по Constitution V (missing)
- [x] T033 Сделать snooze идемпотентным на API, клиенте и PostgreSQL-границе по FR-016 (contradicts)

## Этап 10: Понятное представление экспериментов

- [x] T034 Заменить внутренние ключи протоколов и техническую метку плана обучения на понятные названия, состав и объяснение в `apps/web/src/app/App.tsx`
- [x] T035 Сделать серверную историю раскрываемой с заданиями, оценками, длительностью и результатом проверки через 15 минут в `apps/web/src/app/App.tsx` и покрыть E2E в `tests/e2e/analytics.spec.ts`
