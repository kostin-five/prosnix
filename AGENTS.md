# Правила работы с репозиторием Prosnix

## Продукт

Prosnix — Telegram Mini App для персональных экспериментов пробуждения. Пользователь оценивает
бодрость, проходит назначенный протокол, повторно оценивает состояние и отвечает на follow-up.
Система хранит исходные наблюдения, честно рассчитывает аналитику и может объяснять её через AI.

Перед изменениями прочитайте:

1. [`docs/handoffs/CURRENT.md`](docs/handoffs/CURRENT.md) — где остановилась разработка;
2. [конституцию](.specify/memory/constitution.md) — обязательные границы;
3. [`docs/architecture.md`](docs/architecture.md) — фактическое устройство;
4. актуальную спецификацию в `specs/`, если изменение относится к feature.

## Карта репозитория

- `apps/web` — React/Vite Mini App и публичные страницы;
- `apps/api` — Fastify API, Telegram auth, cron, AI, billing и admin;
- `packages/domain` — детерминированные правила и порты;
- `packages/db` — Drizzle repositories, PostgreSQL schema и forward-only migrations;
- `packages/contracts` — общие TypeBox/TypeScript-контракты;
- `tests/e2e` — мобильные Playwright-сценарии;
- `specs` — Spec Kit спецификации, планы, задачи и validation;
- `docs` — архитектура, эксплуатация, handoff, решения и release-процедуры.

## Команды

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:start
pnpm db:migrate
pnpm dev
```

Web: `http://localhost:5190/?demo=1`; API: `http://localhost:3001`.

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm verify:web-bundle
pnpm verify:production
pnpm test:e2e
pnpm verify:release
pnpm verify:release:full
```

## Правила кода и архитектуры

- TypeScript strict; ESM; форматирование Prettier; существующие имена и границы важнее новых слоёв.
- UI не содержит доменных формул. Домен не импортирует React, Fastify, Drizzle, Telegram или AI SDK.
- Browser не обращается к PostgreSQL и не получает серверные секреты.
- Telegram identity, ownership, session transitions, аналитика, доступ и платежи проверяются сервером.
- Все повторяемые записи получают idempotency key; версии сессий проверяются через `If-Match`.
- Миграции только новые и forward-only. Уже применённые migration-файлы не редактировать.
- AI получает минимум агрегированных данных, не меняет исходные метрики и всегда имеет fallback.
- Не добавлять новый framework, datastore, worker, очередь или provider без spec/ADR.
- Пользовательские тексты и проектная документация — на русском; технические идентификаторы могут
  оставаться английскими.

## Запрещено

- Коммитить `.env`, токены, connection strings, cookie, Telegram `initData` или реальные данные.
- Использовать production DB для тестов, локальных миграций или ручных SQL-экспериментов.
- Подменять серверную аналитику mock-данными вне `?demo=1` и тестовых fixtures.
- Делать медицинские утверждения, скрывать размер выборки или выдавать корреляцию за причинность.
- Включать Telegram Stars, менять webhook, secrets, production deploy или удалять данные без явного
  разрешения владельца.
- Откатывать уже применённую схему БД вместе с кодом.

## Когда нужен Spec Kit

Используйте полный цикл `specify -> clarify -> plan -> tasks -> analyze -> implement -> converge`,
если меняются пользовательский сценарий, модель данных, API-контракт, аналитическая формула,
аутентификация, платежи, внешняя интеграция или production-инфраструктура. Для локального bugfix без
изменения контракта достаточно теста, исправления и обновления затронутой документации. Конституция
меняется отдельно и редко.

## Git, review и deploy

- `master` — стабильная линия; `dev` — интеграционная; feature-ветки именовать `codex/<topic>`.
- Не переписывать чужие изменения и не выполнять destructive git-команды без запроса.
- Коммиты атомарные, в imperative style: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Перед merge обязателен `pnpm verify:release`; при БД/API/release-изменениях —
  `pnpm verify:release:full` на отдельной тестовой БД.
- Deploy начинается только после успешного CI и явного решения владельца. Миграция применяется до
  smoke-test нового API; rollback кода не откатывает схему.
- После завершения этапа обновить roadmap, ADR при новом решении и датированный handoff вместе с
  `docs/handoffs/CURRENT.md`.

Полные процедуры: [`docs/testing.md`](docs/testing.md),
[`docs/release-checklist.md`](docs/release-checklist.md) и [`SECURITY.md`](SECURITY.md).
