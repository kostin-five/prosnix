# План реализации: Финальная Beta-версия MVP

**Ветка**: `dev` | **Дата**: 6 сентября 2026 года | **Спецификация**: [spec.md](./spec.md)

## Краткое описание

Сохранить текущий модульный монолит и закрыть три видимые проблемы MVP: собрать компактный фирменный header, переиспользовать серверный `dailyTrend` в рабочем мини-графике главной и расширить ручной AI-разбор безопасными производными сигналами. Ранний запрос до трёх сессий получает отдельное серверно проверяемое подтверждение; кэш и лимит один provider-вызов в локальный день остаются источником истины.

## Технический контекст

**Язык/версия**: TypeScript 5.9, Node.js 22–24, ESM, strict

**Зависимости**: React 18, Vite 6, Fastify 5, PostgreSQL/Drizzle, lucide-react

**Хранилище**: существующая Neon PostgreSQL; схема не меняется

**Тестирование**: Vitest domain/API/web, contract tests, Playwright mobile E2E

**Целевая платформа**: Telegram Mini App WebView, мобильный браузер 320–390 px

**Ограничения производительности**: initial JavaScript ≤ 240 КиБ; wordmark без полноразмерного raster; график без новой chart-библиотеки

**Масштаб**: до 30 дневных точек в API, до 7 последних на главной; один новый AI provider-вызов на локальный день

## Проверка конституции

- **I. Надёжность** — PASS: сессии и checkpoints не затрагиваются; ошибки AI/аналитики имеют понятный fallback.
- **II. Честные эксперименты** — PASS: график отображает серверные агрегаты; AI не меняет метрики и сообщает ограничения выборки.
- **III. Privacy/Security** — PASS: подтверждение проверяется API, AI получает только агрегаты без evidence IDs.
- **IV. Модульность** — PASS: производные сигналы формирует coach service, UI только отображает контракт.
- **V. Проверяемость** — PASS: добавляются unit, contract, component и mobile E2E проверки.
- **VI. Контролируемые изменения** — PASS: provider, datastore, worker и migration не добавляются; production не изменяется.

После проектирования все gates остаются PASS. Исключений нет.

## Структура изменений

```text
apps/web/src/app/App.tsx
apps/web/src/features/brand/prosnix-brand.tsx
apps/web/src/features/analytics/home-wake-chart.tsx
apps/web/src/features/coach/use-coach-insight.ts
apps/web/src/shared/api/client.ts
apps/api/src/coach/{routes,service,deepseek}.ts
packages/contracts/src/index.ts
apps/{web,api}/tests/
tests/e2e/
docs/{architecture,product-roadmap}.md
docs/handoffs/
```

## Архитектурные решения

1. Wordmark реализуется как локальный семантический React/SVG-компонент с текстовым `h1` для accessibility. Он использует текущие orange/yellow tokens, не добавляет image request и масштабируется до 320 px.
2. `ProductBetaBadge` переиспользуется в header главной и заголовках статистики/настроек. Beta — один статус на область, не декоративная приписка в каждой карточке.
3. Главная берёт последние семь элементов из `AnalyticsProfile.dailyTrend`. Новый лёгкий `HomeWakeChart` имеет фиксированную область столбцов, симметричную нулевую линию и явные подписи значения/`n`, поэтому percentage height рассчитывается относительно контейнера, а не auto-height.
4. `POST /api/v1/coach/insight` принимает JSON `{ confirmEarly?: boolean }`. Без подтверждения при `evidenceCount < 3` возвращается `confirmation_required` и `insight: null`; provider и дневной кэш не затрагиваются.
5. После подтверждения ранний запрос проходит тот же fingerprint/cache/quota pipeline. Одновременные запросы по пользователю коалесцируются.
6. Payload расширяется обезличенными `trendSignals`: число дней, направление последнего изменения и вариативность; evidence IDs и точные timestamps отбрасываются.
7. Provider сохраняет совместимый трёхчастный формат: `summary` становится анализом закономерностей/устойчивости, `nextExperiment` — проверяемым следующим шагом, `caveat` — ограничениями выборки. Миграция кэша не нужна.
8. Сервер валидирует тело маршрута общей схемой. UI сначала показывает inline-confirmation, а затем отправляет `confirmEarly: true` только по явной второй кнопке.
9. Fallback строит полезный отчёт из rise success, trend variability и доступных протокольных/факторных контрастов; технические provider names в пользовательский текст не попадают.

## Наблюдаемость, безопасность и rollback

- Событие `coach_insight_completed` получает `earlyConfirmed`, но не сохраняет текст отчёта или identity.
- Некорректное тело получает 400 до service; web client всегда отправляет `content-type: application/json`.
- Prompt запрещает пересказ среднего прироста как главного вывода, диагнозы и причинные утверждения.
- Rollback не требует отката схемы: БД не меняется, новое поле запроса optional.
- Старый клиент без тела получает безопасный путь: при 3+ сессиях отчёт, при меньшем числе — запрос подтверждения.

## Отслеживание сложности

Новых архитектурных механизмов нет. Изменение ограничено существующими brand, analytics и coach границами.
