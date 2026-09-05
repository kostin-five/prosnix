# План реализации: Качество пробуждения и производительность

**Ветка**: `dev` | **Дата**: 5 сентября 2026 года | **Спецификация**: [spec.md](./spec.md)

## Краткое описание

Усилить критический wake-flow без нового framework: вынести правила когнитивных заданий в тестируемый web-модуль, сохранить уровень сложности наблюдения, добавить серверный дневной ряд аналитики, сделать AI строго ручным с одним новым бесплатным вызовом в локальный день и разделить редкие UI-области на chunks. Одновременно удалить неиспользуемый Figma UI-kit и его прямые зависимости.

## Технический контекст

**Язык/версия**: TypeScript 5.9, Node.js 22–24, ESM, strict

**Основные зависимости**: React 18, Vite 6, Fastify 5, Drizzle ORM, PostgreSQL и lucide-react

**Хранилище**: существующая PostgreSQL/Neon; новая forward-only миграция `0006` добавляет nullable уровень сложности к task observation

**Тестирование**: Vitest domain/API/web, PostgreSQL integration, Playwright mobile E2E

**Целевая платформа**: Telegram Mini App WebView и мобильный браузер

**Тип проекта**: pnpm-монорепозиторий web + API + domain/contracts/db

**Цели производительности**: initial JavaScript до 240 КиБ; редкие экраны в отдельных chunks; отсутствие AI-запроса при простом открытии статистики

**Ограничения**: без камеры, шагомера, wearable, нового provider, очереди или analytics SDK; существующие наблюдения остаются воспроизводимыми

**Масштаб**: история до 20 последних сессий в пользовательском UI; дневной ряд до 30 последних локальных дат; один новый AI-анализ на локальный день

## Проверка конституции

- **I. Надёжность** — PASS: активная сессия и checkpoints не меняются при ленивой загрузке; ошибка chunk имеет retry.
- **II. Честные эксперименты** — PASS: неверные ответы не считаются выполнением, шаги названы самопроверкой, дневной ряд строится только из парных наблюдений с размером выборки.
- **III. Privacy/Security** — PASS: AI остаётся серверным, получает только агрегаты; лимит проверяет сервер; новых датчиков и персональных классов данных нет.
- **IV. Модульность** — PASS: аналитическая группировка находится в domain/API, persistence в repository, UI только отображает готовые значения.
- **V. Проверяемость** — PASS: правила заданий, contract, migration, component и E2E покрываются автоматическими тестами.
- **VI. Контролируемые изменения** — PASS: миграция только подготавливается и тестируется локально; production применение остаётся за владельцем.

После проектирования все gates остаются PASS. Исключений нет.

## Структура проекта

### Документация функции

```text
specs/009-wake-quality-and-performance/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/http-api.md
├── checklists/requirements.md
└── tasks.md
```

### Основные изменения кода

```text
apps/web/src/app/App.tsx
apps/web/src/features/tasks/task-engine.ts
apps/web/src/features/analytics/daily-trend.tsx
apps/web/src/features/coach/use-coach-insight.ts
apps/web/src/features/settings/settings-screen.tsx
apps/web/src/features/personalization/capability-profile-card.tsx
apps/web/src/features/legal/{privacy-policy,terms-of-use,legal-back}.tsx
apps/web/src/shared/api/client.ts
apps/api/src/{analytics,coach}/
packages/domain/src/{model,analytics}/
packages/contracts/src/index.ts
packages/db/src/{schema,repositories}/
packages/db/migrations/0006_task_difficulty.sql
```

## Архитектурные решения

1. Математика и память используют чистые генераторы и state transitions в `features/tasks/task-engine.ts`; React-компоненты отвечают только за ввод и визуальную обратную связь.
2. Математика завершается только после трёх правильных ответов и использует диапазон сложности 1–3. Неверный ответ не продвигает прогресс; две правильные подряд повышают уровень, а две ошибки подряд понижают его, чтобы пользователь не застревал.
3. Память состоит из двух раундов, между показом и вводом есть задержка; успешный раунд увеличивает длину последовательности, неуспешный повторяется один раз на текущем или упрощённом уровне.
4. Для движения сервер продолжает хранить честно названное self-reported наблюдение. UI включает обязательный 20-секундный интервал для ходьбы; камера и accelerometer не имитируются.
5. `task_observations.difficulty_level` nullable для обратной совместимости. Старые строки остаются валидными, а новые когнитивные задания передают integer 1–3.
6. `AnalyticsProfile.dailyTrend` рассчитывается доменным кодом из канонических парных сессий. Дата определяется часовым поясом пользователя, значение — среднее `post - baseline`, рядом остаётся число сессий.
7. История остаётся отдельным endpoint; UI связывает раскрытие дня с уже загруженными пользовательскими сессиями по локальной дате, не пересчитывая метрику.
8. Coach endpoint меняется на явный `POST`. Service сначала возвращает актуальный fingerprint cache, затем блокирует второй новый provider-вызов до следующей локальной полуночи. Fallback не расходует provider quota.
9. В AI-ответ добавляются `source`, `refreshAvailableAt` и `limitReached`, чтобы UI не додумывал причину кэша.
10. Настройки лениво импортируются из `App`; методологическая справка и дневной график также выделяются. Legal pages сохраняют отдельные entry chunks из `main.tsx`.
11. Неиспользуемый каталог Figma UI primitives и неиспользуемый image fallback удаляются. В web dependencies остаются только пакеты, импортируемые runtime-кодом или build CSS.

## Наблюдаемость, безопасность и rollback

- Событие coach фиксирует `source`, cache/quota без identity и текста ответа.
- Второй provider-вызов в тот же локальный день предотвращается сервером, даже если клиент повторяет запрос.
- Некорректный timezone безопасно заменяется UTC.
- Миграция nullable и backward-compatible; rollback кода игнорирует новый столбец, схема не откатывается.
- Ошибка lazy import показывает retry. Reload разрешён только как явное действие и не очищает server checkpoint.

## Отслеживание сложности

Новый datastore, provider или framework не добавляются. Единственная новая persistence-деталь — nullable поле наблюдения, нужное для воспроизводимости адаптивного задания.
