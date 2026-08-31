# План реализации: Надёжный UX и AI Wake Coach

**Ветка**: `dev` | **Дата**: 2026-08-31 | **Спецификация**: [spec.md](./spec.md)

## Краткое описание

Исправить пустой JSON POST при закрытии сессии, добавить серверный snooze, отдельный экран настроек,
понятные источники и реальную историю. AI Wake Coach вызывается только сервером, получает
агрегированный профиль без идентификаторов, возвращает проверяемый JSON и кэшируется по отпечатку
доказательств. Основной алгоритм назначения протокола не передаётся модели.

## Технический контекст

**Язык/версия**: TypeScript 5.9, Node.js 22

**Основные зависимости**: React 18, Fastify 5, Drizzle ORM, PostgreSQL 17, Telegram Bot API,
DeepSeek Chat Completions HTTP API

**Хранение**: Neon PostgreSQL; новая таблица кэша AI-выводов, существующие wake-сессии и расписание

**Тестирование**: Vitest unit/contract/integration, PostgreSQL integration, Playwright mobile E2E

**Целевая платформа**: Telegram Mini App, Render API и Static Site

**Тип проекта**: pnpm workspace, модульный монолит

**Цели производительности**: cached AI <500 мс; внешний AI timeout 12 секунд; история до 20 сессий;
первоначальный JS chunk <250 КБ

**Ограничения**: секреты только на сервере; AI получает только агрегаты; минимум 3 сессии; JSON
валидируется; deterministic fallback; snooze работает через существующий cron

**Масштаб этапа**: staging-пилот до 10 000 пользователей; одна актуальная AI-карточка на профиль

## Проверка конституции

_До исследования: PASS._

| Принцип                         | Статус | Обоснование                                                                  |
| ------------------------------- | ------ | ---------------------------------------------------------------------------- |
| I. Надёжность пробуждения       | PASS   | Исправляется restart, snooze хранится серверно, AI имеет fallback            |
| II. Честные эксперименты        | PASS   | Модель объясняет агрегаты, но не меняет наблюдения или назначение протокола  |
| III. Приватность и безопасность | PASS   | Ключ серверный, payload без ID и времени, политика обновляется               |
| IV. Модульная архитектура       | PASS   | AI gateway, cache repository, history и schedule остаются отдельными портами |
| V. Тестируемая поставка         | PASS   | Контрактные, adapter, DB и mobile E2E тесты обязательны                      |

Исключений нет.

## Структура проекта

### Документация функции

```text
specs/004-product-polish-ai/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
├── checklists/requirements.md
└── tasks.md
```

### Изменяемый исходный код

```text
packages/contracts/src/index.ts
packages/domain/src/{ports,model}.ts
packages/db/src/{schema,repositories/}.ts
packages/db/migrations/0003_ai_coach_cache.sql
apps/api/src/{app,coach,analytics,notifications,sessions}/
apps/web/src/{app,features,shared}/
apps/{api,web}/tests/
tests/e2e/
docs/
```

**Решение по структуре**: сохранить текущие workspace-границы. DeepSeek adapter находится только в
API, кэш и выборка истории — в DB adapter, UI получает узкие готовые контракты.

## Архитектура и поток данных

### AI Coach

1. Аутентифицированный GET запрашивает актуальный серверный analytics profile.
2. Сервис строит канонический payload только из значений, evidenceCount, confidence и безопасных
   ключей факторов/протоколов, затем вычисляет SHA-256 fingerprint.
3. При evidenceCount <3 возвращается `insufficient` без внешнего запроса.
4. При совпадении fingerprint возвращается кэш.
5. Иначе gateway делает один POST `/chat/completions` с timeout, JSON mode и коротким системным
   промптом; результат проверяется по runtime-контракту и длине.
6. Валидный результат сохраняется upsert по пользователю. Сбой даёт `unavailable`, не затрагивая
   аналитику и wake flow.

### Snooze

1. Аутентифицированный POST без тела загружает существующее включённое расписание.
2. `nextTriggerAt` атомарно переносится на `now + 5 минут`, revision увеличивается.
3. Существующий cron выдаёт одно напоминание и рассчитывает следующий запуск по сохранённым
   `localTime`/timezone, поэтому ежедневное время не сдвигается.

### История и UI

1. Новый read endpoint возвращает до 20 завершённых сессий текущего пользователя с оценками,
   заданиями и follow-up, но без внутренних assignment ID.
2. Stats показывает историю и человекочитаемую методику без UUID.
3. Третья вкладка Settings владеет расписанием, приватностью и удалением профиля.

## Границы доверия и защита

- `DEEPSEEK_API_KEY` читается только API и запрещён production bundle check.
- В AI payload нет Telegram ID, UUID, точного времени, timezone и сырых записей.
- Ответ внешней модели считается недоверенным: JSON parsing, allow-list полей, типы и лимиты длины.
- AI content не используется как команда, SQL, HTML или изменение эксперимента.
- Логи содержат provider status, latency, cached и evidenceCount, но не prompt/response.
- History и snooze требуют существующую signed cookie session.

## Надёжность, миграции и откат

- `0003` только добавляет `coach_insights`; FK cascade удаляет карточку с профилем.
- Старый API игнорирует новую таблицу, поэтому rollback не требует down migration.
- Upsert по `user_id` и fingerprint устраняет повторное хранение; параллельный запрос может вызвать
  провайдера дважды, но каноническим остаётся один результат. На пилоте этого достаточно; UI
  дедуплицирует запрос внутри mounted screen.
- Timeout/429/5xx/invalid JSON не кэшируются как персональный вывод.
- Snooze использует существующую транзакционную запись schedule и дедупликацию delivery.

## Наблюдаемость

- `coach_insight_completed`: status, cached, evidenceCount, latencyMs, model — без content.
- `wake_schedule_snoozed`: revision и delayMinutes — без user ID в metadata.
- Понятные клиентские ошибки заменяют отображение голого HTTP-кода.

## Проверка конституции после проектирования

Все пять принципов соблюдены. AI отделён от детерминированных метрик, источник остаётся
воспроизводимым, деградация безопасна, секреты и идентификаторы не пересекают внешнюю границу.
Статус **PASS**.

## Отслеживание сложности

Новые сервисы и SDK не добавляются: используется стандартный server-side fetch. Одна небольшая
таблица оправдана контролем стоимости и стабильностью UI.
