# Правила работы с репозиторием Prosnix

## Продукт

Prosnix — Telegram Mini App для персональных экспериментов пробуждения после любого сна. Пользователь оценивает
бодрость, проходит назначенный протокол, повторно оценивает состояние и отвечает на follow-up.
Система хранит исходные наблюдения, честно рассчитывает аналитику и может объяснять её через AI.

Перед любыми изменениями полностью прочитайте в таком порядке:

1. этот `AGENTS.md`;
2. [конституцию](.specify/memory/constitution.md);
3. [`docs/handoffs/CURRENT.md`](docs/handoffs/CURRENT.md) и указанный в нём актуальный handoff;
4. [`docs/handoffs/DEVELOPER_ONBOARDING.md`](docs/handoffs/DEVELOPER_ONBOARDING.md);
5. [`docs/product-roadmap.md`](docs/product-roadmap.md);
6. [`docs/architecture.md`](docs/architecture.md);
7. [`docs/api-contracts.md`](docs/api-contracts.md);
8. [`docs/testing.md`](docs/testing.md);
9. [`docs/release-checklist.md`](docs/release-checklist.md);
10. [`SECURITY.md`](SECURITY.md);
11. актуальный OpenSpec change из handoff: `proposal.md`, `design.md`, `tasks.md` и нужные
    `specs/*/spec.md`; при наличии также `openspec/specs/` для затронутых возможностей.

`.specify/feature.json` и `specs/` — история предыдущего Spec Kit процесса, а не указатель на
текущую работу. Читайте их только если это нужно для совместимости или контекста задачи.

Для подключения нового AI-чата используйте готовый
[`docs/handoffs/NEW_CHAT_PROMPT.md`](docs/handoffs/NEW_CHAT_PROMPT.md). Он не заменяет документы
выше: агент обязан прочитать их и сначала выполнить только read-only аудит. До ответа владельца на
предложенный следующий шаг не менять код, документацию, ветки или внешние сервисы. Git-аудит
ограничен `status`, `log`, `branch -vv`, `rev-list` и `merge-base`; `fetch`, `pull`, `push` и смена
ветки требуют разрешения.

## Карта репозитория

- `apps/web` — React/Vite Mini App и публичные страницы;
- `apps/api` — Fastify API, Telegram auth, cron, AI, billing и admin;
- `packages/domain` — детерминированные правила и порты;
- `packages/db` — Drizzle repositories, PostgreSQL schema и forward-only migrations;
- `packages/contracts` — общие TypeBox/TypeScript-контракты;
- `tests/e2e` — мобильные Playwright-сценарии;
- `openspec` — действующие изменения, спецификации и задачи;
- `specs` и `.specify` — история предыдущих этапов Spec Kit;
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
- Сохранять модульный монолит; не создавать параллельную архитектуру без явного согласования.
- Пользовательские тексты и проектная документация — на русском; технические идентификаторы могут
  оставаться английскими.

## Запрещено

- Читать содержимое `.env` или других файлов с реальными секретами при ознакомительном аудите;
  для конфигурации используйте только `.env.example` и документацию.
- Передавать или коммитить токены, пароли, connection strings, cookie, Telegram `initData`,
  пользовательские ответы или персональные данные.
- Использовать production DB для тестов, локальных миграций или ручных SQL-экспериментов.
- Подменять серверную аналитику mock-данными вне `?demo=1` и тестовых fixtures.
- Делать медицинские утверждения, скрывать размер выборки или выдавать корреляцию за причинность.
- Включать Telegram Stars, менять webhook, secrets, production deploy или удалять данные без явного
  разрешения владельца.
- Откатывать уже применённую схему БД вместе с кодом.

## Когда нужен OpenSpec

Если меняются пользовательский сценарий, модель данных, API-контракт, аналитическая формула,
аутентификация, платежи, внешняя интеграция или production-инфраструктура, сначала проверьте
существующий OpenSpec change. Если он покрывает задачу, обновите его артефакты и продолжайте
реализацию; новый change создавайте только для отдельного scope. Используйте соответствующие
`openspec-explore`, `openspec-propose`, `openspec-update-change`, `openspec-apply-change`,
`openspec-sync-specs` и `openspec-archive-change` по назначению. Для локального bugfix без изменения
контракта достаточно regression-теста, исправления и обновления затронутой документации.
Конституция меняется отдельно и редко.

## Git, review и deploy

- `master` — стабильная линия; `dev` — интеграционная; feature-ветки именовать `codex/<topic>`.
- Не переписывать чужие изменения и не выполнять destructive git-команды без запроса.
- Коммиты атомарные, в imperative style: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- После небольшого изменения сообщайте, что изменено, проверено и не проверено, а также риски.
- Перед merge обязателен `pnpm verify:release`; при БД/API/release-изменениях —
  `pnpm verify:release:full` на отдельной тестовой БД.
- Наличие commit в `dev` не подтверждает deploy: нужен зелёный CI точного SHA, ручной Telegram
  smoke-test и отдельное решение владельца о выпуске.
- Deploy начинается только после успешного CI и явного решения владельца. Миграция применяется до
  smoke-test нового API; rollback кода не откатывает схему.
- После завершения этапа обновить roadmap, ADR при новом решении и датированный handoff вместе с
  `docs/handoffs/CURRENT.md`.

Полные процедуры: [`docs/testing.md`](docs/testing.md),
[`docs/release-checklist.md`](docs/release-checklist.md) и [`SECURITY.md`](SECURITY.md).
