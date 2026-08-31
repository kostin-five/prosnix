# Задачи: Релизное усиление MVP

## Этап 1: Зависимости и подготовка

- [x] T001 Удалить неиспользуемый `react-router`, обновить `drizzle-orm` до 0.45.2 и добавить официальные security-плагины в `apps/web/package.json`, `packages/db/package.json`, `apps/api/package.json` и `pnpm-lock.yaml`
- [x] T002 [P] Проверить и дополнить ignore-настройки для секретов, сборок и отчётов в `.gitignore`, `.dockerignore` и `.prettierignore`
- [x] T003 Добавить и провалидировать серверные параметры readiness/rate-limit в `.env.example`, `apps/api/src/app/config.ts` и `apps/api/tests/app/config.test.ts`

## Этап 2: Надёжная готовность и завершение

**Цель истории**: платформа отличает живой процесс от готового экземпляра и безопасно завершает deploy.

**Независимая проверка**: `/ready` отвечает 200/503 по состоянию БД, повторный SIGTERM закрывает ресурсы один раз.

- [x] T004 [P] [US1] Добавить contract-тесты liveness/readiness без раскрытия ошибок в `apps/api/tests/contract/health.test.ts`
- [x] T005 [P] [US1] Добавить unit-тесты идемпотентного shutdown и deadline в `apps/api/tests/runtime/graceful-shutdown.test.ts`
- [x] T006 [US1] Добавить лёгкую проверку соединения в `packages/db/src/repositories/index.ts` и подключить readiness dependency в `apps/api/src/app/create-app.ts`
- [x] T007 [US1] Реализовать тестируемый graceful shutdown в `apps/api/src/runtime/graceful-shutdown.ts` и подключить его в `apps/api/src/server.ts`

## Этап 3: Защищённые API-границы

**Цель истории**: публичные запросы имеют безопасные заголовки, пределы размера/частоты и не используют уязвимые production-пакеты.

**Независимая проверка**: contract-тест подтверждает headers, 413 и 429 до побочного эффекта; production audit не содержит high/critical.

- [x] T008 [P] [US2] Добавить contract-тесты security headers, no-store, body limit и auth rate-limit в `apps/api/tests/contract/hardening.test.ts`
- [x] T009 [P] [US2] Добавить contract-тест отсутствия вызова Coach после rate-limit в `apps/api/tests/contract/coach-rate-limit.test.ts`
- [x] T010 [US2] Зарегистрировать helmet, no-store, body limit и нейтральный 429 в `apps/api/src/app/create-app.ts`
- [x] T011 [US2] Добавить явный предел Telegram `initData` и route-specific rate-limit в `apps/api/src/auth/routes.ts` и `apps/api/src/coach/routes.ts`
- [x] T012 [US2] Подтвердить совместимость обновлённого Drizzle полным PostgreSQL integration-набором из `apps/api/tests/integration/`

## Этап 4: Проверяемая поставка

**Цель истории**: каждое изменение получает воспроизводимый quality/security/E2E gate и диагностический отчёт.

**Независимая проверка**: workflow syntax валиден, содержит минимальные permissions, concurrency, audit и artifact on failure.

- [x] T013 [P] [US3] Усилить обязательный pipeline concurrency, audit и Playwright artifact в `.github/workflows/ci.yml`
- [x] T014 [P] [US3] Настроить еженедельные ограниченные dependency PR для pnpm и GitHub Actions в `.github/dependabot.yml`
- [x] T015 [US3] Добавить локальную агрегирующую release-проверку в `package.json` и описать соответствие CI-командам

## Этап 5: Эксплуатационная документация

**Цель истории**: владелец запускает, диагностирует и откатывает сервис по русской документации.

**Независимая проверка**: README ведёт к одной инструкции с env, deploy, readiness, backup, smoke, rollback и incident flow.

- [x] T016 [P] [US4] Создать русскую эксплуатационную инструкцию в `docs/operations.md`
- [x] T017 [US4] Переработать `README.md` как короткую точку входа и синхронизировать `/ready` в `docs/telegram-mini-app-setup.md` и `docs/release-roadmap.md`

## Этап 6: Финальная проверка

- [x] T018 Выполнить format, typecheck, unit, чистую PostgreSQL integration, build, bundle/security audit и mobile E2E по `specs/005-release-hardening/quickstart.md`, записать результат в `specs/005-release-hardening/validation.md`

## Зависимости

- T001–T003 блокируют реализацию runtime и security-границ.
- US1 и тесты US2 можно готовить независимо после T003; изменения `create-app.ts` выполняются последовательно.
- US3 и US4 независимы от runtime-кода и могут выполняться после фиксации команд проверки.
- T018 выполняется только после всех пользовательских историй.

## Стратегия реализации

Сначала устранить известные уязвимости и зафиксировать конфигурацию. Затем тестами определить
readiness/shutdown и HTTP-защиту, после чего реализовать их без изменения доменной модели. В конце
усилить CI, создать операционную инструкцию и прогнать полный релизный набор на чистой PostgreSQL.
