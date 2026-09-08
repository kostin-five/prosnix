# План: ясность перед пилотом

## Кратко

Исправить счётчик результата через существующий analytics endpoint, переработать lazy-компонент
профиля, визуализировать последние session deltas из history, улучшить детерминированный Coach
fallback и prompt, затем поправить существующие SVG paths. Новых API, таблиц и зависимостей нет.

## Constitution check

- Надёжность: до server response показывается честное состояние обновления.
- Эксперименты: `n`, ограничения и отсутствие причинности сохраняются; формулы не меняются.
- Приватность: график строится в браузере из уже разрешённой истории; AI payload не расширяется.
- Архитектура: вычисляемый fallback остаётся в API service, UI только интерпретирует агрегаты.
- Проверяемость: component/service/E2E и release gate обязательны.
- Изменения: нет migration, provider, framework или production mutation.

## Точки изменения

- `apps/web/src/app/App.tsx` — счётчик результата и presentation отчёта.
- `apps/web/src/features/analytics/wake-profile-summary.tsx` — выводы, рекомендации и график.
- `apps/web/src/features/tasks/task-icon.tsx` — иконка ходьбы.
- `apps/web/src/features/brand/prosnix-brand.tsx` — солнце и лучи.
- `apps/api/src/coach/service.ts`, `deepseek.ts` — содержательный fallback и prompt.
- component/service/E2E tests и фактические docs.

## Риски и откат

- Главный риск — лимит initial bundle; график остаётся внутри уже lazy profile chunk.
- При analytics/history error UI не делает предположений.
- Откат кодовый, схема и исходные данные не меняются.
