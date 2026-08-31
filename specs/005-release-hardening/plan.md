# План реализации: Релизное усиление MVP

**Ветка**: `dev` | **Дата**: 2026-08-31 | **Спецификация**: [spec.md](./spec.md)

## Краткое описание

Закрыть найденные production-уязвимости зависимостей, добавить проверяемые HTTP-защиты и ограничения
дорогих границ, сделать readiness зависимой от PostgreSQL и обеспечить идемпотентное штатное
завершение. Усилить существующий GitHub Actions pipeline аудитом, отменой устаревших запусков,
диагностическими артефактами и Dependabot, затем собрать русскую эксплуатационную документацию.

## Технический контекст

**Язык/версия**: TypeScript 5.9, Node.js 22

**Основные зависимости**: React 18, Vite 6, Fastify 5, `@fastify/helmet`,
`@fastify/rate-limit`, Drizzle ORM 0.45.2, PostgreSQL 17

**Хранение**: существующая Neon PostgreSQL; новых таблиц и миграций нет

**Тестирование**: Vitest unit/contract/integration, PostgreSQL integration, Playwright mobile E2E,
production dependency audit

**Целевая платформа**: Telegram Mini App, Render API/Static Site, GitHub Actions

**Тип проекта**: pnpm workspace, модульный монолит

**Цели производительности**: readiness до 2 секунд; штатное завершение до 10 секунд; начальный JS
ниже 250 КиБ; отклонение ограниченного запроса до внешнего вызова

**Ограничения**: секреты только на сервере; один API instance на staging; rate-limit в памяти
процесса; без изменения пользовательской схемы и контрактов wake-сессии

**Масштаб этапа**: staging и закрытая бета до 10 000 пользователей

## Проверка конституции

| Принцип                         | Статус | Обоснование                                                                |
| ------------------------------- | ------ | -------------------------------------------------------------------------- |
| I. Надёжность пробуждения       | PASS   | readiness и graceful shutdown устраняют ложную готовность и обрыв deploy   |
| II. Честные эксперименты        | PASS   | алгоритмы и данные не меняются; integration/E2E остаются обязательными     |
| III. Приватность и безопасность | PASS   | удаляются уязвимые зависимости, вводятся no-store, headers, limits и audit |
| IV. Модульная архитектура       | PASS   | runtime lifecycle и security-плагины остаются в API/infrastructure слое    |
| V. Проверяемая поставка         | PASS   | CI получает audit, concurrency, артефакты и автоматические dependency PR   |

Повторная проверка после дизайна: **PASS**. Новых персональных данных, внешних провайдеров и
необратимых миграций нет.

## Исследование и решения

Результаты находятся в [research.md](./research.md). Ключевые решения:

1. Неиспользуемый `react-router` удалить, а не обновлять: runtime не импортирует его.
2. Drizzle ORM закрепить на минимальной исправленной совместимой версии 0.45.2 и прогнать реальные
   PostgreSQL integration-тесты.
3. Использовать официальные плагины Fastify для защитных заголовков и локального rate-limit; не
   создавать самописную криптографию или распределённый limiter до масштабирования.
4. `/health` оставить дешёвой liveness-проверкой, добавить `/ready` с ограниченной проверкой БД;
   Render после deploy должен использовать `/ready`.
5. Graceful shutdown вынести в тестируемый lifecycle-модуль и защитить от повторного сигнала.
6. Dependency audit сделать обязательной отдельной CI-границей; автоматическое обновление — только
   через проверяемые PR.

## Проектная структура

```text
apps/api/
├── src/app/create-app.ts              # headers, body limit, readiness wiring
├── src/app/config.ts                  # rate-limit/readiness параметры
├── src/runtime/graceful-shutdown.ts   # жизненный цикл процесса
├── src/auth/routes.ts                 # auth rate-limit и input bound
├── src/coach/routes.ts                # AI rate-limit
├── src/server.ts                      # DB readiness и signals
└── tests/                             # contract/runtime/config regression

packages/db/
└── src/repositories/index.ts          # лёгкая проверка соединения

.github/
├── workflows/ci.yml                   # quality/security/E2E gate
└── dependabot.yml                     # ограниченные dependency PR

docs/
└── operations.md                      # deploy, smoke, backup, rollback, incidents
```

**Структурное решение**: существующий модульный монолит сохраняется. Изменения ограничены API
runtime/infrastructure, зависимостями, автоматизацией и документацией; web-продукт и доменные
алгоритмы не переписываются.

## Ошибки, наблюдаемость и откат

- Readiness пишет только структурированное событие с категорией зависимости и request ID; исходное
  исключение остаётся в server log, но клиент получает `service_unavailable`.
- Rate-limit возвращает 429 без вызова handler; значения cookie, initData и body не логируются.
- Graceful shutdown логирует начало, завершение и превышение deadline без секретов.
- Изменения зависимостей откатываются предыдущим commit/deploy; миграций нет.
- Если limiter мешает реальному трафику, лимиты изменяются серверными env-переменными без изменения
  клиента. При масштабировании более одного instance limiter переносится во внешнее хранилище.

## Границы сложности

Нарушений конституции и новых подсистем нет. Redis, отдельный gateway и новый deployment provider
не вводятся, поскольку текущий staging использует один API instance.
