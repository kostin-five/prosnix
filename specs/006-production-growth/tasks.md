# Задачи: Production growth Prosnix

**Ввод**: документы из `specs/006-production-growth/`

**Тесты**: обязательны для security, persistence, metrics, payments и основных UI-состояний.

## Фаза 1: Подготовка

- [x] T001 Зафиксировать legal/billing/admin контракты в `packages/contracts/src/index.ts`
- [x] T002 Расширить server-only конфигурацию и fail-closed validation в `apps/api/src/app/config.ts`
- [x] T003 Добавить forward-only схему и миграцию в `packages/db/src/schema.ts` и `packages/db/migrations/0004_production_growth.sql`

## Фаза 2: Общий фундамент

- [x] T004 Добавить domain-типы и порты admin/legal/billing в `packages/domain/src/ports.ts`
- [x] T005 Экспортировать новые repository adapters из `packages/db/src/repositories/index.ts`
- [x] T006 Подключить зависимости и маршруты в `apps/api/src/app/create-app.ts` и `apps/api/src/server.ts`
- [x] T007 Обновить test config и memory helpers в `apps/api/tests/helpers.ts`

## Фаза 3: История 1 — приватная owner-аналитика (P1)

**Цель**: защищённая агрегированная сводка без внешнего analytics SDK.

**Независимый тест**: allowlisted пользователь получает корректные 7/30/90-дневные агрегаты; остальные получают 404; JSON не содержит идентификаторов.

- [x] T008 [US1] Написать contract-тесты доступа и формы ответа в `apps/api/tests/contract/admin-growth.test.ts`
- [x] T009 [US1] Написать PostgreSQL integration-тест формул в `apps/api/tests/integration/production-growth.test.ts`
- [x] T010 [US1] Реализовать SQL-агрегаты и retention в `packages/db/src/repositories/admin-analytics.ts`
- [x] T011 [US1] Реализовать fail-closed admin route в `apps/api/src/admin/routes.ts`
- [x] T012 [US1] Реализовать responsive dashboard в `apps/web/src/features/admin/admin-screen.tsx`
- [x] T013 [US1] Добавить маршрут `/admin` и web-тест состояний в `apps/web/src/main.tsx` и `apps/web/tests/production-growth.test.tsx`

## Фаза 4: История 2 — юридический контур Prosnix (P2)

**Цель**: публичные документы, cookie disclosure и versioned acceptance.

**Независимый тест**: принятие сохраняется, смена версии требует повтор, удаление профиля очищает запись.

- [x] T014 [US2] Написать contract/integration-тесты legal acceptance в `apps/api/tests/contract/legal.test.ts` и `apps/api/tests/integration/production-growth.test.ts`
- [x] T015 [US2] Реализовать legal repository в `packages/db/src/repositories/legal.ts`
- [x] T016 [US2] Реализовать status/accept routes в `apps/api/src/legal/routes.ts`
- [x] T017 [US2] Добавить legal gate API/UI в `apps/web/src/features/legal/legal-gate.tsx`
- [x] T018 [US2] Переработать политику Prosnix и добавить соглашение в `apps/web/src/features/legal/privacy-policy.tsx` и `apps/web/src/features/legal/terms-of-use.tsx`
- [x] T019 [US2] Подключить `/terms`, gate и ссылки настроек в `apps/web/src/main.tsx` и `apps/web/src/features/settings/settings-screen.tsx`
- [x] T020 [US2] Покрыть gate и документы тестами в `apps/web/tests/production-growth.test.tsx` и `tests/e2e/privacy.spec.ts`

## Фаза 5: История 3 — безопасный foundation Telegram Stars (P3)

**Цель**: выключенная по умолчанию месячная подписка с server-side entitlement.

**Независимый тест**: disabled state безопасен; валидная тестовая оплата активирует доступ один раз; неверный secret/checkout отклоняется.

- [x] T021 [US3] Написать contract-тесты billing/status/checkout/webhook в `apps/api/tests/contract/billing.test.ts`
- [x] T022 [US3] Написать PostgreSQL integration-тест оплаты и продлений в `apps/api/tests/integration/production-growth.test.ts`
- [x] T023 [US3] Реализовать billing repository transitions в `packages/db/src/repositories/billing.ts`
- [x] T024 [US3] Реализовать Telegram invoice/payment gateway в `apps/api/src/billing/telegram-stars.ts`
- [x] T025 [US3] Реализовать billing service/routes/webhook в `apps/api/src/billing/service.ts` и `apps/api/src/billing/routes.ts`
- [x] T026 [US3] Добавить Pro status/checkout card behind flag в `apps/web/src/features/billing/pro-card.tsx`
- [x] T027 [US3] Подключить Pro card и web-тест disabled state в `apps/web/src/features/settings/settings-screen.tsx` и `apps/web/tests/production-growth.test.tsx`

## Фаза 6: История 4 — переход на `@prosnix_bot` (P4)

**Цель**: безопасная инструкция использования общей инфраструктуры.

**Независимый тест**: чек-лист покрывает BotFather, token switch, webhook, policy, reminders и rollback без секретов.

- [x] T028 [US4] Создать production switch/runbook в `docs/prosnix-production.md`
- [x] T029 [US4] Обновить README и roadmap с новым брендом и реальным статусом в `README.md` и `docs/release-roadmap.md`

## Фаза 7: Завершение

- [x] T030 Обновить env template и setup-инструкцию без секретов в `.env.example` и `docs/telegram-mini-app-setup.md`
- [x] T031 Запустить format/typecheck/unit/integration/build/security/E2E по `specs/006-production-growth/quickstart.md`
- [x] T032 Проверить миграцию на чистой PostgreSQL и rollback старого приложения в `specs/006-production-growth/validation.md`
- [x] T033 Отметить выполненные задачи и проверить отсутствие идентификаторов/секретов в bundle и admin JSON в `specs/006-production-growth/tasks.md`

## Зависимости

- T001–T007 блокируют пользовательские истории.
- US1 и US2 независимы после фундамента.
- US3 зависит от legal acceptance US2.
- US4 не зависит от billing deploy, но описывает его production gate.
- Финальная фаза зависит от всех выбранных историй.

## Стратегия реализации

1. Сначала dashboard: он даёт бесплатный инструмент принятия продуктовых решений.
2. Затем legal gate и документы: они нужны до внешней beta и оплаты.
3. Потом billing behind flag: тестируется без случайного включения продаж.
4. Последним выполняется production runbook и полный release verification.
