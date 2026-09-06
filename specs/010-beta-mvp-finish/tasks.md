# Задачи: Финальная Beta-версия MVP

## Phase 1: Подготовка

- [x] T001 Зафиксировать спецификацию, план, research, data model, HTTP contract и quickstart в `specs/010-beta-mvp-finish/`
- [x] T002 Проверить существующие ignore-файлы и отсутствие новых секретов/production-настроек в `.gitignore`, `.dockerignore` и `.prettierignore`

## Phase 2: Базовые компоненты

- [x] T003 [P] Создать доступный wordmark и общий Beta badge в `apps/web/src/features/brand/prosnix-brand.tsx`
- [x] T004 [P] Создать лёгкий дневной график главной в `apps/web/src/features/analytics/home-wake-chart.tsx`
- [x] T005 [P] Добавить component tests бренда и графика в `apps/web/tests/beta-mvp.test.tsx`

## Phase 3: История 1 — Фирменный и адаптивный header

- [x] T006 [US1] Подключить wordmark, независимый счётчик сессий и Beta к главной в `apps/web/src/app/App.tsx`
- [x] T007 [US1] Добавить Beta к заголовкам статистики и настроек в `apps/web/src/app/App.tsx` и `apps/web/src/features/settings/settings-screen.tsx`
- [x] T008 [US1] Проверить layout 320–390 px в `tests/e2e/analytics.spec.ts`

## Phase 4: История 2 — Рабочая дневная динамика

- [x] T009 [US2] Перевести главную с history items на последние семь `dailyTrend` и добавить empty/loading/error состояния в `apps/web/src/app/App.tsx`
- [x] T010 [US2] Покрыть положительные, нулевые, отрицательные и одиночные значения в `apps/web/tests/beta-mvp.test.tsx`
- [x] T011 [US2] Проверить реальные дневные подписи, значения и размер выборки на главной в `tests/e2e/analytics.spec.ts`

## Phase 5: История 3 — Глубокий персональный отчёт

- [x] T012 [P] [US3] Добавить request schema и статус `confirmation_required` в `packages/contracts/src/index.ts`
- [x] T013 [P] [US3] Расширить safe aggregate payload trend signals и строгий prompt в `apps/api/src/coach/deepseek.ts`
- [x] T014 [US3] Реализовать раннее подтверждение, глубокий deterministic fallback и совместимый cache/quota flow в `apps/api/src/coach/service.ts`
- [x] T015 [US3] Валидировать JSON body и передавать подтверждение в `apps/api/src/coach/routes.ts`
- [x] T016 [US3] Обновить client/hook для `confirmEarly` в `apps/web/src/shared/api/client.ts` и `apps/web/src/features/coach/use-coach-insight.ts`
- [x] T017 [US3] Переделать AI-card в персональный отчёт с inline confirmation и нетехническим source label в `apps/web/src/app/App.tsx`
- [x] T018 [P] [US3] Обновить unit tests payload, prompt, fallback, cache и раннего подтверждения в `apps/api/tests/coach/`
- [x] T019 [US3] Обновить contract tests валидного/невалидного тела и provider quota в `apps/api/tests/contract/coach.test.ts` и `apps/api/tests/contract/coach-rate-limit.test.ts`
- [x] T020 [US3] Проверить раннее подтверждение и содержательный отчёт в `tests/e2e/analytics.spec.ts`

## Phase 6: Полировка и проверка

- [x] T021 [P] Обновить фактическую архитектуру и roadmap в `docs/architecture.md` и `docs/product-roadmap.md`
- [x] T022 [P] Создать новый датированный handoff и обновить `docs/handoffs/CURRENT.md`
- [x] T023 Выполнить format, typecheck, unit, contract, integration, build, bundle и mobile E2E проверки по `specs/010-beta-mvp-finish/quickstart.md`
- [x] T024 Провести финальную сверку spec/plan/tasks с реализацией и записать результат в `specs/010-beta-mvp-finish/validation.md`

## Зависимости

- Phase 1 предшествует всем изменениям.
- T003–T005 можно выполнять параллельно; T006–T011 используют эти компоненты.
- T012 и T013 независимы, затем T014–T017 выполняются по контракту.
- T018 можно начать после T013–T014; T019 после T015; T020 после T017.
- Документация и полный gate выполняются после пользовательских историй.

## Независимые критерии

- **US1**: header не пересекается на 320 px, а Beta видна на трёх вкладках.
- **US2**: главная отображает серверные дневные агрегаты со знаком и `n`, пустое состояние не выглядит сломанным графиком.
- **US3**: до трёх сессий provider не вызывается без подтверждения; отчёт анализирует устойчивость и контрасты, fallback остаётся полезным.

## Стратегия

Сначала закрываются три P1-сценария без новых зависимостей и миграций. После unit/contract проверок выполняется mobile E2E, bundle gate и полный release gate на одноразовой тестовой БД.
