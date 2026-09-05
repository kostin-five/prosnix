# Задачи: Качество пробуждения и производительность

## Phase 1: Подготовка

- [x] T001 Зафиксировать baseline bundle и карту runtime-импортов в specs/009-wake-quality-and-performance/validation.md
- [x] T002 Удалить неиспользуемые Figma UI-файлы и прямые web-зависимости в apps/web/src/app/components и apps/web/package.json

## Phase 2: Общие контракты и хранение

- [x] T003 [P] Расширить task/analytics/coach типы в packages/domain/src/model.ts и packages/domain/src/ports.ts
- [x] T004 [P] Расширить HTTP-схемы в packages/contracts/src/index.ts
- [x] T005 Добавить nullable difficulty_level в packages/db/src/schema.ts и packages/db/migrations/0006_task_difficulty.sql
- [x] T006 Провести difficultyLevel через session state и repository в packages/domain/src/session/session.ts и packages/db/src/repositories/sessions.ts
- [x] T007 [P] Добавить тесты task-result контракта и persistence в packages/domain/tests и apps/api/tests

## Phase 3: Эффективные задания (US1)

- [x] T008 [P] [US1] Добавить чистые генераторы и адаптацию математики/памяти в apps/web/src/features/tasks/task-engine.ts
- [x] T009 [P] [US1] Добавить unit-тесты движка в apps/web/tests/task-engine.test.ts
- [x] T010 [US1] Перевести MathTask и MemoryTask на новый движок в apps/web/src/app/App.tsx
- [x] T011 [US1] Добавить 20-секундный барьер и честную подпись шагов в apps/web/src/app/App.tsx
- [x] T012 [US1] Исправить безопасную инструкцию света в apps/web/src/app/App.tsx
- [x] T013 [US1] Добавить mobile component/E2E проверки заданий в apps/web/tests и tests/e2e

## Phase 4: Реальная динамика (US2)

- [x] T014 [P] [US2] Добавить доменный расчёт dailyTrend и timezone edge cases в packages/domain/src/analytics/profile.ts
- [x] T015 [P] [US2] Расширить AnalyticsRepository источниками даты/контекста/timezone в packages/db/src/repositories/analytics.ts
- [x] T016 [P] [US2] Добавить contract и integration тесты дневного ряда в apps/api/tests
- [x] T017 [US2] Добавить лёгкий компонент графика/empty state в apps/web/src/features/analytics/daily-trend.tsx
- [x] T018 [US2] Подключить dailyTrend и компактную справку в apps/web/src/app/App.tsx
- [x] T019 [US2] Добавить component/E2E проверки реальной динамики в apps/web/tests и tests/e2e

## Phase 5: Ручной AI с дневным лимитом (US3)

- [x] T020 [P] [US3] Добавить timezone/quota вычисления и source metadata в apps/api/src/coach/service.ts
- [x] T021 [P] [US3] Изменить coach route на POST и privacy-safe logging в apps/api/src/coach/routes.ts
- [x] T022 [P] [US3] Расширить repository доступом к timezone в packages/db/src/repositories/coach-insights.ts
- [x] T023 [P] [US3] Добавить contract/service/integration тесты одного provider-вызова в день в apps/api/tests
- [x] T024 [US3] Сделать hook ручным и обновить API client в apps/web/src/features/coach/use-coach-insight.ts и apps/web/src/shared/api/client.ts
- [x] T025 [US3] Заменить автоматический AI-блок на кнопку, cache/quota/fallback состояния в apps/web/src/app/App.tsx
- [x] T026 [US3] Добавить component/E2E проверки отсутствия автоматического вызова в apps/web/tests и tests/e2e

## Phase 6: Компактные настройки и legal navigation (US4)

- [x] T027 [P] [US4] Добавить общий безопасный back control в apps/web/src/features/legal/legal-back.tsx и обе legal страницы
- [x] T028 [P] [US4] Сделать анкету свёрнутой после onboarding в apps/web/src/features/personalization/capability-profile-card.tsx
- [x] T029 [P] [US4] Переписать AI-пояснение настроек без provider-конфигурации в apps/web/src/features/settings/settings-screen.tsx
- [x] T030 [US4] Добавить component/E2E проверки legal back и анкеты в apps/web/tests и tests/e2e

## Phase 7: Code splitting (US5)

- [x] T031 [US5] Лениво загрузить settings и вторичные статистические компоненты в apps/web/src/app/App.tsx
- [x] T032 [US5] Добавить retry boundary для lazy chunks в apps/web/src/app/lazy-boundary.tsx
- [x] T033 [US5] Упростить apps/web/vite.config.ts после удаления Figma resolver и проверить chunk names
- [x] T034 [US5] Ужесточить initial bundle limit до 240 КиБ в scripts/verify-web-bundle.mjs
- [x] T035 [US5] Добавить bundle regression проверки и подтвердить ленивые chunks в scripts и specs/009-wake-quality-and-performance/validation.md

## Phase 8: Документация и проверка

- [x] T036 [P] Обновить docs/architecture.md, docs/api-contracts.md и docs/product-roadmap.md
- [x] T037 [P] Обновить docs/testing.md, docs/release-checklist.md и privacy/terms текст при изменении AI-поведения
- [x] T038 Выполнить pnpm verify:release:full на отдельной локальной БД и записать результаты в specs/009-wake-quality-and-performance/validation.md
- [x] T039 Создать новый датированный handoff и обновить docs/handoffs/CURRENT.md

## Зависимости

- Phase 2 блокирует US1–US3.
- US1, US2 и legal/анкета из US4 независимы после Phase 2.
- US5 выполняется после UI-изменений US1–US4, чтобы измерить окончательную раскладку.
- Phase 8 выполняется после всех историй.

## Параллельные возможности

- T003 и T004; T008 и T009; T014–T016; T020–T023; T027–T029; T036 и T037.
- Изменения одного файла App.tsx выполняются последовательно.

## Стратегия реализации

Сначала сохранить честные task observations и исправить задания, затем добавить реальную динамику и лимит AI. После UX-полировки удалить мёртвую поверхность зависимостей, разделить редкие экраны и провести полный release gate. Каждая история имеет отдельные автоматические проверки и остаётся демонстрируемой независимо.
