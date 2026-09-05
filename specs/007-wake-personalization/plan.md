# План реализации: Персонализация пробуждения

**Каталог**: `007-wake-personalization` | **Дата**: 2026-09-04 | **Спецификация**: [spec.md](spec.md)

## Краткое содержание

Добавить серверный профиль возможностей, обязательный выбор контекста и длительности перед новой сессией, контекстно-корректную экспериментальную аналитику, отдельную пользовательскую рутину и централизованную солнечную тему. Расширение идёт внутри текущего React/Fastify/PostgreSQL монорепозитория: браузер использует только версионированные API-контракты, сервер проверяет владение и допустимость, домен остаётся детерминированным, а рутина не попадает в доказательства эффективности.

## Технический контекст

**Язык/версия**: TypeScript 5.9, Node.js 22–24, ESM, strict
**Основные зависимости**: React 18, Vite, Tailwind CSS 4, Fastify 5, TypeBox, Drizzle ORM
**Хранилище**: PostgreSQL/Neon; локально PostgreSQL через Docker Compose
**Тестирование**: Vitest для domain/API/web, интеграционные тесты PostgreSQL, Playwright для мобильного E2E
**Целевая платформа**: Telegram Mini App WebView на iOS/Android и современный мобильный браузер
**Тип проекта**: pnpm-монорепозиторий web + API + shared domain/contracts/db
**Цели производительности**: API чтения настроек p95 до 300 мс без холодного старта; отсутствие нового блокирующего запроса после bootstrap; web bundle остаётся в установленном бюджете
**Ограничения**: одна production БД на текущем этапе; миграции forward-only; отсутствие медиа и health-данных; безопасный fallback при недоступности персонализации; ширина от 320 px
**Масштаб этапа**: один профиль и одна активная рутина на пользователя, до 5 пунктов рутины, 4 контекста, 3 временных бюджета, существующий пул из 10 заданий

## Проверка конституции

### До проектирования

- **Надёжность**: PASS — контекст и ограничения входят в неизменяемый снимок сессии; изменения профиля действуют только на будущие назначения.
- **Экспериментальная честность**: PASS — рутина хранится отдельно и не участвует в метриках; сравнения раскрывают контекст и размер выборки.
- **Приватность и AI**: PASS — камера и медиа вне этапа; новые ответы не отправляются в DeepSeek; AI остаётся объясняющим слоем над агрегатами.
- **Архитектурные границы**: PASS — новые правила находятся в domain, доступ к PostgreSQL только через db repositories, HTTP-контракт общий.
- **Проверяемость**: PASS — запланированы unit, contract, integration, accessibility и mobile E2E проверки.
- **Production authority**: PASS — код и новая миграция готовятся локально; применение в Neon, deploy, push и переключение бота не выполняются без решения владельца.

### После проектирования

- Новые framework, datastore, worker, очередь и внешний provider не добавлены.
- Одна forward-only миграция расширяет существующую схему и сохраняет совместимость старых сессий через значения по умолчанию.
- API записи использует серверную Telegram-сессию, `Idempotency-Key` и `If-Match` для изменяемых ресурсов.
- Данные профиля минимальны: функциональные ограничения, условия и предпочтение длительности без диагноза или медицинской интерпретации.
- Отклонений от конституции нет.

## Структура проекта

### Документация функции

```text
specs/007-wake-personalization/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
├── checklists/requirements.md
└── tasks.md
```

### Исходный код

```text
packages/contracts/src/index.ts
packages/domain/src/{model,ports,personalization}.ts
packages/domain/tests/personalization.test.ts
packages/db/migrations/0005_wake_personalization.sql
packages/db/src/schema.ts
packages/db/src/repositories/{personalization,sessions,bootstrap,session-history,analytics}.ts
apps/api/src/personalization/routes.ts
apps/api/src/app/create-app.ts
apps/api/src/server.ts
apps/api/tests/contract/personalization.test.ts
apps/api/tests/integration/wake-personalization.test.ts
apps/web/src/app/App.tsx
apps/web/src/features/personalization/*
apps/web/src/features/settings/settings-screen.tsx
apps/web/src/shared/api/client.ts
apps/web/src/styles/theme.css
apps/web/tests/personalization.test.tsx
tests/e2e/wake-personalization.spec.ts
```

**Решение по структуре**: используются существующие слои монорепозитория. Доменные фильтры не зависят от Fastify/Drizzle/React; PostgreSQL-репозитории реализуют порты; API связывает authenticated user с репозиториями; web хранит только временное состояние формы и получает каноническое состояние с сервера.

## Последовательность реализации

1. Общие типы, валидаторы и чистая функция выбора допустимых шагов.
2. Forward-only миграция, схема и серверные репозитории профиля/рутины.
3. Расширение создания и загрузки сессии неизменяемым контекстом.
4. API профиля, рутины и прогресса с проверкой владельца, версии и идемпотентности.
5. Контекстная фильтрация аналитики с сохранением общей истории.
6. Клиентские формы запуска и настройки, отдельный этап рутины.
7. Солнечные токены и доступность.
8. Полный набор тестов, документация, bundle/security/release проверки.

## Отслеживание сложности

Отклонений, требующих оправдания, нет.
