# API-контракты Prosnix

**Base path:** same-origin `/api/v1`; внутренние endpoints находятся под `/internal`.  
**Source of truth:** routes в `apps/api/src` и schemas в `packages/contracts`.

Этот файл — карта API, а не OpenAPI schema. При расхождении действует код, после чего документ должен
быть исправлен.

## Общие правила

- Персональные маршруты требуют cookie `awc_session`, полученную через Telegram auth.
- Все ответы `/api`, `/internal`, `/health`, `/ready` имеют `Cache-Control: no-store`.
- Максимальное тело запроса — 32 КиБ.
- State-changing session requests требуют `Idempotency-Key` длиной 8–128 символов.
- Переход существующей session требует `If-Match: <positive-version>`.
- `400` — неверный контракт/заголовок; `401` — нет auth; `404` admin скрыт; `409` — conflict;
  `429` — rate limit; `503` — dependency/feature unavailable.
- При unexpected error возвращаются безопасный code и `requestId`, без stack trace.

## Health

| Метод | Маршрут   | Назначение                                               |
| ----- | --------- | -------------------------------------------------------- |
| GET   | `/health` | liveness процесса, без проверки БД                       |
| GET   | `/ready`  | readiness с ограниченной по времени проверкой PostgreSQL |

## Auth и профиль

| Метод  | Маршрут                 | Вход/результат                                          |
| ------ | ----------------------- | ------------------------------------------------------- |
| POST   | `/api/v1/auth/telegram` | `{ initData }`; проверяет подпись, ставит cookie, `204` |
| GET    | `/api/v1/bootstrap`     | user, session, follow-up, schedule, профиль и рутина    |
| DELETE | `/api/v1/me`            | каскадно удаляет профиль и очищает cookie, `204`        |

Auth ограничен отдельным per-IP rate limit. Browser не передаёт Telegram user ID как identity.

## Wake-сессии

| Метод | Маршрут                                | Дополнительные требования                    |
| ----- | -------------------------------------- | -------------------------------------------- |
| POST  | `/api/v1/sessions`                     | timezone, wakeContext, duration, idempotency |
| PUT   | `/api/v1/sessions/:id/baseline`        | rating body, idempotency, `If-Match`         |
| PUT   | `/api/v1/sessions/:id/steps/:index`    | task result, idempotency, `If-Match`         |
| PUT   | `/api/v1/sessions/:id/post-rating`     | rating body, idempotency, `If-Match`         |
| PUT   | `/api/v1/sessions/:id/follow-up`       | `{ outcome }`, idempotency                   |
| POST  | `/api/v1/sessions/:id/abandon`         | idempotency, `If-Match`                      |
| GET   | `/api/v1/sessions/history?limit=1..20` | последние завершённые сессии                 |

Conflict `409` возвращает code и canonical session, чтобы клиент мог восстановить актуальное
состояние. Повтор идентичной операции возвращает сохранённый результат; повтор key с другим payload
отклоняется.

## Analytics и Coach

| Метод | Маршрут                     | Результат                                             |
| ----- | --------------------------- | ----------------------------------------------------- |
| GET   | `/api/v1/analytics/profile` | пересчитанные метрики, confidence и evidence metadata |
| POST  | `/api/v1/coach/insight`     | ручной персональный отчёт с cache/fallback            |

Профиль аналитики включает `dailyTrend`: среднее парное изменение бодрости по локальным календарным
датам, число сессий и их evidence IDs. Контексты разных типов сна объединяются только в этом обзорном
ряду; причинные сравнения протоколов по-прежнему разделены по контексту.

`POST /api/v1/coach/insight` принимает JSON `{ "confirmEarly": boolean }`. При числе завершённых
сессий меньше трёх и отсутствии подтверждения возвращается `confirmation_required` без вызова
provider. Подтверждённый ранний отчёт проходит тот же серверный cache и лимит одного нового вызова
за локальный календарный день. AI получает только агрегаты и безопасные сигналы динамики, но не
evidence IDs, точное время, Telegram identity или сырые ответы.

Открытие статистики не вызывает Coach. Пользователь явно нажимает кнопку, после чего сервер создаёт
не более одного нового provider-разбора за локальный календарный день. Повторный запрос возвращает
cache или fallback и поля `source`, `limitReached`, `refreshAvailableAt`. Coach имеет отдельный rate
limit и не меняет analytics или session state.

## Настройки и уведомления

| Метод | Маршрут                            | Назначение                                              |
| ----- | ---------------------------------- | ------------------------------------------------------- |
| GET   | `/api/v1/me/wake-schedule`         | текущее расписание                                      |
| PUT   | `/api/v1/me/wake-schedule`         | local time, timezone, enabled                           |
| POST  | `/api/v1/me/wake-schedule/snooze`  | сдвиг ближайшей отправки на 5 минут; idempotency        |
| POST  | `/internal/notifications/dispatch` | daily/follow-up worker; Bearer `CRON_SECRET`, `{}` JSON |

Dispatch возвращает агрегированную summary и `409`, если текущий процесс уже выполняет запуск.
cron-job.org не получает DB credentials или bot token.

## Персонализация и рутина

| Метод | Маршрут                        | Назначение                                     |
| ----- | ------------------------------ | ---------------------------------------------- |
| GET   | `/api/v1/me/wake-profile`      | текущие возможности и ограничения              |
| PUT   | `/api/v1/me/wake-profile`      | профиль; `Idempotency-Key`, `If-Match`         |
| GET   | `/api/v1/me/wake-routine`      | текущая личная рутина                          |
| PUT   | `/api/v1/me/wake-routine`      | максимум пять пунктов; idempotency, `If-Match` |
| GET   | `/api/v1/sessions/:id/routine` | сохранённый прогресс рутины завершённой сессии |
| PUT   | `/api/v1/sessions/:id/routine` | отметить пункты; idempotency, `If-Match`       |

Профиль только исключает неподходящие задания. Контекст и бюджет сохраняются в снимке сессии.
Рутина отделена от экспериментальных наблюдений и не участвует в аналитике.

## Legal

Публичные документы обслуживает web на `/privacy` и `/terms`.

| Метод | Маршрут                | Назначение                           |
| ----- | ---------------------- | ------------------------------------ |
| GET   | `/api/v1/legal/status` | текущие версии и факт принятия       |
| POST  | `/api/v1/legal/accept` | принять точные текущие версии, `204` |

Если версия изменилась между чтением и записью, сервер возвращает `409 legal_version_changed`.

## Admin

| Метод | Маршрут                | Назначение                                                                |
| ----- | ---------------------- | ------------------------------------------------------------------------- |
| GET   | `/api/v1/admin/growth` | агрегированная продуктовая и эксплуатационная сводка за 7, 30 или 90 дней |

Требуется Telegram auth и server allowlist. Неавторизованный пользователь получает `404`. Ответ не
содержит Telegram IDs, user/session UUID или индивидуальные оценки.

Query-параметр `days` принимает только `7`, `30` или `90`; без него используется `7`. Ответ включает:

- all-time, новых и активных пользователей;
- когортную воронку assigned, started, completed и followed-up;
- среднее изменение бодрости только по парным baseline/post-rating и размер этой выборки;
- follow-up outcomes, D1/D7 retention и 24-часовую UTC-динамику;
- разбивки по контексту и бюджету времени;
- агрегаты завершённых анкет, новых включённых рутин, запусков рутины, AI-объяснений,
  Telegram-доставок и Telegram Stars за период.

Все доли вычисляются сервером и при нулевом знаменателе равны `0`. Когорта сессий фиксируется по
`wake_sessions.created_at` внутри полуинтервала `[from, to)`; события после `to` не учитываются.

## Billing и Telegram webhook

| Метод | Маршрут                      | Назначение                                             |
| ----- | ---------------------------- | ------------------------------------------------------ |
| GET   | `/api/v1/billing/status`     | бесплатный/Pro статус и период                         |
| POST  | `/api/v1/billing/checkout`   | создать Stars invoice link; rate limited               |
| POST  | `/internal/telegram/webhook` | commands, pre-checkout, payment и subscription updates |

Checkout закрыт при цене `0` и требует актуального legal acceptance. Webhook до чтения update
проверяет `X-Telegram-Bot-Api-Secret-Token`. Update ID и payment charge ID идемпотентны. Currency
должна быть `XTR`, а владелец, payload и amount сверяются с server checkout.

Поддерживаемые команды webhook: `/privacy`, `/terms`, `/paysupport <сообщение>`.
