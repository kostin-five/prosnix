# План: адаптивное обучение протоколам

**Ветка**: `codex/adaptive-protocol-learning` | **Дата**: 7 сентября 2026 года | **Спецификация**: [spec.md](./spec.md)

## Кратко

Расширяем существующий модуль экспериментов детерминированным adaptive-v2 selector. PostgreSQL
repository загружает только канонические завершённые наблюдения пользователя, домен ранжирует
персонализированные варианты внутри того же контекста и бюджета, а repository сохраняет выбранную
фактическую последовательность и reason как раньше. Analytics v2 добавляет прогресс сравнений и
готовую общую сводку после семи сессий. Admin получает отдельный server-side агрегат возврата ко
второй сессии за семь суток, не меняя D1/D7.

## Технический контекст

- **Язык**: TypeScript strict, ESM; React/Vite web; Fastify API.
- **Хранилище**: действующая PostgreSQL/Drizzle schema; новая migration не требуется.
- **Домен**: `packages/domain` остаётся единственным местом формул выбора и аналитики.
- **Данные выбора**: baseline/post-rating, nullable follow-up, wake context, duration и фактический
  task order завершённых сессий; рутина и AI не используются.
- **Совместимость**: старые `learning-v1`, `continuation-v1` и `analytics-v1` записи читаются;
  новые назначения получают `adaptive-v2`, новый профиль — `analytics-v2`.
- **Проверки**: deterministic domain fixtures, API contract/component tests, PostgreSQL integration,
  mobile E2E и `pnpm verify:release:full` на disposable PostgreSQL.

## Constitution check

| Принцип                         | Решение                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Reliable Wake-Up Continuity  | При ошибке или недостатке evidence selector возвращает безопасный детерминированный кандидат; state machine не меняется.                                                      |
| II. Truthful Experimentation    | Сравниваются только одинаковые context/duration; сохраняются strategy/method version, n, confidence и ограничения; повторы используются для проверки, не как причинный вывод. |
| III. Privacy and Security       | Evidence загружается только server repository для владельца; web/admin получают агрегаты; AI payload не расширяется.                                                          |
| IV. Modular Domain Architecture | Формулы находятся в domain; Drizzle только собирает canonical inputs; React только отображает результаты.                                                                     |
| V. Testable Delivery            | Формулы получают ручные fixtures, persistence — integration, критический UX — component/E2E.                                                                                  |
| VI. Controlled Change           | Используются существующие границы и таблицы; нет provider, migration или production mutation.                                                                                 |

Post-design check: нарушений конституции и необходимости ADR не обнаружено — новый механизм заменяет
циклическую стратегию внутри существующего experiment domain, не создавая параллельную архитектуру.

## Проектная структура и точки изменения

```text
packages/domain/src/model.ts                         # adaptive evidence, profile progress, v2 types
packages/domain/src/experiments/learning.ts          # candidate catalog и adaptive-v2 ranking
packages/domain/src/personalization.ts               # personalized candidate set и exact-repeat guard
packages/domain/src/analytics/profile.ts             # analytics-v2 и comparison progress
packages/domain/tests/                               # ручные deterministic fixtures
packages/db/src/repositories/sessions.ts             # canonical evidence query перед назначением
packages/db/src/repositories/analytics.ts            # context/duration evidence и v2 projections
packages/db/src/repositories/admin-analytics.ts      # second-session-within-7-days aggregate
packages/domain/src/ports.ts                         # admin aggregate contract
packages/contracts/src/index.ts                      # public admin response contract
apps/api/src/admin/routes.ts                         # rate presentation
apps/web/src/shared/api/client.ts                    # analytics v2 client contract
apps/web/src/app/App.tsx                             # содержательный профиль и progress
apps/web/src/features/tasks/                         # единые task icons и timer motion
apps/web/src/features/admin/admin-screen.tsx         # пилотная карточка возврата
apps/**/tests, tests/e2e                              # regressions
docs/                                                # фактическая архитектура, API, roadmap, handoff
```

## Последовательность реализации

1. Зафиксировать тестами каталог допустимых вариантов, ranking и запрет непосредственного повтора.
2. Добавить adaptive evidence model и чистый selector с versioned score/reason.
3. Подключить server-side загрузку завершённых наблюдений при создании сессии.
4. Зафиксировать analytics-v2 profile summary и progress сравнений, затем обновить UI статистики.
5. Добавить отдельный pilot return aggregate, API contract и admin card, сохранив D1/D7.
6. Заменить task emoji на существующие векторные иконки и добавить доступную timer animation.
7. Выполнить unit/component, integration и E2E; синхронизировать документацию и handoff.

## Failure modes, наблюдаемость и откат

- Пустое или повреждённое evidence не блокирует wake flow: selector использует первый допустимый
  неповторяющийся кандидат и reason о недостатке данных.
- Если персонализация сводит несколько шаблонов к одной последовательности, дубликаты кандидатов
  схлопываются до ranking, а единственный вариант может повториться.
- Нет новых персональных логов: существующее событие назначения содержит только strategy/phase.
- Кодовый rollback возвращает прежнюю стратегию; схема не меняется, historical `adaptive-v2`
  assignments остаются читаемыми через общую модель.
- Production deploy и Telegram smoke-test остаются отдельным решением владельца после зелёного CI.
