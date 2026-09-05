# Фактическая архитектура Prosnix

**Актуально на:** 5 сентября 2026 года
**Версия кода:** кандидат `0.2` в `dev` после `008-admin-dashboard` плюс незакоммиченный этап
`009-wake-quality-and-performance`

Этот документ описывает реализованную систему. Планируемые изменения находятся в
[`product-roadmap.md`](product-roadmap.md).

## Общая схема

```text
Telegram client
  -> Render Static Site: React/Vite
  -> same-origin /api rewrite
  -> Render Web Service: Fastify API
       -> Neon PostgreSQL
       -> Telegram Bot API
       -> DeepSeek API (необязательно)

cron-job.org
  -> POST /internal/notifications/dispatch
  -> Fastify API -> PostgreSQL reservation -> Telegram Bot API
```

Это модульный монолит в pnpm workspace. Web, API и библиотеки собираются отдельно, но доменные
правила и persistence остаются в одном репозитории и одном процессе API.

## Frontend

`apps/web` — React 18 и Vite 6. Основные области:

- аутентификация из Telegram WebApp `initData` и загрузка bootstrap;
- ручной запуск после любого сна: контекст, бюджет времени, baseline, задания, post-rating, результат
  и follow-up;
- профиль допустимых заданий и отдельная редактируемая рутина после измеряемого протокола;
- статистика, история с раскрываемыми деталями эксперимента и AI-объяснение;
- настройки расписания, snooze, юридические документы и удаление профиля;
- публичные `/privacy` и `/terms`;
- закрытый `/admin`, загружаемый отдельно и доступный только allowlisted Telegram ID;
- `?demo=1` — демонстрационный режим без реальных пользовательских данных.

Настройки, график, legal-страницы и админка загружаются отдельными chunks. Ошибка ленивой загрузки
показывает безопасный повтор без очистки серверного checkpoint. Проверка `verify:web-bundle`
ограничивает initial JavaScript значением 240 КиБ. Последняя сборка этапа `009`: 236,1 КиБ initial
JavaScript, 35,97 КБ CSS; лёгкий график — 1,27 КБ, настройки — 17,01 КБ.

## Backend

`apps/api` — Fastify 5. `createApp` собирает зависимости, а `server.ts` подключает production
repositories и gateways.

Главные модули:

- `auth` — HMAC-проверка Telegram `initData`, срок запуска, серверная `awc_session` cookie;
- `sessions` — versioned state machine и идемпотентные команды;
- `personalization` — versioned профиль возможностей, рутина и прогресс конкретной сессии;
- `analytics` — пересчёт профиля из канонических наблюдений;
- `coach` — подготовка обезличенного контекста, DeepSeek, JSON validation, cache и fallback;
- `notifications` — расписание, snooze, daily/follow-up dispatch, retry и retention logs;
- `legal` — версия политики/условий и явное принятие;
- `billing` — выключенный по умолчанию Telegram Stars checkout/webhook/subscription foundation;
- `admin` — закрытая продуктовая сводка за 7/30/90 дней: когортная воронка, парное изменение
  бодрости, follow-up, D1/D7, UTC-динамика, разбивки, использование функций, доставки и billing;
- `observability` — структурные события request/session/dispatch/coach и `requestId`;
- `runtime` — readiness и graceful shutdown.

Точные маршруты и требования заголовков перечислены в
[`api-contracts.md`](api-contracts.md).

## Домен и контракты

`packages/domain` не зависит от UI, Fastify, Drizzle или внешних API. Здесь находятся модели,
переходы сессии, экспериментальная стратегия, аналитика, расписание и repository ports.

`packages/contracts` содержит общие схемы входов и ответов. Сервер всё равно повторно проверяет
identity, ownership, состояние, версию и платежные условия: тип клиента не является доверием.

## Аутентификация и авторизация

1. Telegram открывает Mini App и передаёт подписанный `initData`.
2. Web отправляет его в `POST /api/v1/auth/telegram`.
3. API проверяет HMAC текущим bot token и допустимый возраст данных.
4. Пользователь создаётся/находится по Telegram ID.
5. API устанавливает подписанную `HttpOnly` cookie `awc_session` на 30 дней.
6. Каждый персональный маршрут извлекает внутренний UUID только из cookie.

Cookie имеет `SameSite=Strict`, а в production также `Secure`. Admin дополнительно сверяет Telegram
ID владельца с `ADMIN_TELEGRAM_USER_IDS` и отвечает `404` для остальных.

## Wake-сессия и надёжность записи

Каноническая последовательность:

```text
assigned -> in_progress -> protocol_completed -> follow-up observation
                  \-> abandoned
```

Каждая команда записи имеет `Idempotency-Key`; переходы существующей сессии требуют актуальный
`If-Match`. Уникальные ограничения PostgreSQL не допускают две активные сессии пользователя,
повторную оценку одного типа или повторный результат шага. Bootstrap возвращает активную сессию и
due follow-up, поэтому сценарий восстанавливается после закрытия Mini App.

Перед созданием новой сессии пользователь выбирает контекст и бюджет 2, 5 или 10 минут. Сервер
фильтрует протокол по сохранённому профилю возможностей и записывает неизменяемый снимок применённых
ограничений. При нехватке допустимых заданий назначается короткий безопасный fallback. Ручной запуск
не требует расписания; экран snooze открывается только из wake-напоминания через `?source=wake`.

Когнитивные задания адаптируют сложность только внутри текущего задания. Математика требует три
правильных ответа, память состоит из двух раундов; фактические попытки и nullable уровень 1–3
сохраняются в task observation. Ходьба остаётся честной самопроверкой с 20-секундным барьером, без
имитации шагомера. Световая инструкция допускает дневной свет у окна или яркое освещение комнаты и
не предлагает смотреть прямо на солнце.

## Эксперименты и аналитика

Назначение хранит protocol version, strategy version, phase, hypothesis и evidence snapshot.
Исходные оценки, task results и follow-up не перезаписываются AI-ответом. Analytics repository
пересчитывает производные показатели с method version, evidence count, confidence и evidence IDs.
Смешанный протокол не приписывает общий эффект каждой категории без сопоставимого сравнения.
Протокольные и факторные сравнения разделяются по контексту пробуждения. Обзорная дневная динамика
группирует все завершённые пробуждения по локальной календарной дате и показывает средний парный
прирост вместе с размером выборки. Это не объединяет контексты для причинных выводов. Выполнение
личной рутины никогда не входит в evidence и не меняет confidence.

## AI

DeepSeek вызывается только из API и только после явного нажатия пользователя. В payload не
передаются Telegram ID, внутренние UUID, cookie или полная история. Модель объясняет уже рассчитанные
агрегаты и не управляет выбором доступа, оплатой или состоянием сессии. Сервер разрешает не более
одного нового provider-разбора за локальный календарный день, проверяет ответ и кэширует его по
fingerprint доказательств. Без ключа, при ошибке или недостатке данных возвращается
детерминированный текст; открытие статистики само по себе внешнего запроса не делает.

## Фоновые задачи и Telegram

Отдельной очереди нет. cron-job.org раз в пять минут отправляет защищённый Bearer-запрос в API.
API атомарно резервирует due daily/follow-up deliveries в PostgreSQL, отправляет их через Telegram,
делает ограниченный retry и удаляет только технические delivery logs старше 90 дней. Перекрывающийся
dispatch одного процесса получает `409`.

## Платежи

Основа Telegram Stars реализована, но продажи выключены при `TELEGRAM_STARS_MONTHLY_PRICE=0`.
Checkout создаётся сервером только после принятия актуальных документов. Webhook проверяет отдельный
secret token до обработки update. Checkout, payment ledger, update IDs и subscription state хранятся
раздельно; повторный update или charge не продлевает доступ дважды. Активация требует ручного
production gate из [`release-checklist.md`](release-checklist.md).

## Хранение данных

PostgreSQL 17/Neon — единственный production source of truth. Основные таблицы: users, schedules,
notification deliveries, protocol definitions, assignments, sessions, capability profiles,
wake routines и их session snapshots, rating/task/follow-up observations, idempotency records,
analytics projections, coach insights, legal acceptances, billing checkouts, subscriptions, Stars
payments/updates и audit events. `task_observations.difficulty_level` — nullable поле для
воспроизводимости адаптивных когнитивных заданий и обратной совместимости старых сессий.

Миграции находятся в `packages/db/migrations` и применяются только вперёд. Удаление профиля каскадно
удаляет персональные сессии, настройки, AI cache, принятия и billing-записи в приложении.

## Среды, deploy и rollback

- Local: Docker PostgreSQL, web `5190`, API `3001`.
- Текущая удалённая среда: Render Static Site + Render API + Neon + cron-job.org.
- `dev` используется как интеграционная и staging-линия; `master` пока содержит исходный baseline.
- API health: `/health`; готовность API вместе с БД: `/ready`.
- Render получает server secrets только через Environment. Static Site получает лишь публичные
  `VITE_LEGAL_*` значения.
- Rollback переключает Render на предыдущий рабочий commit. Forward-only migrations не откатываются.

Отдельной production БД и always-on instance пока нет. Бесплатный Render может иметь cold start, а
текущие dev/production-контуры временно используют общую инфраструктуру.

## Наблюдаемость и границы

Логи Fastify содержат event, route, status, duration и requestId, но не должны содержать токены,
cookie, `initData` или пользовательские ответы. Отдельного error tracking/SLO dashboard пока нет.
Cron summary и `/admin` дают базовую operational/product visibility. Админ-панель строится только
по серверным агрегатам: она не возвращает Telegram ID, UUID, индивидуальные оценки, тексты рутины
или evidence IDs. Ошибки в её эксплуатационном блоке относятся только к сохранённым попыткам
Telegram-доставки; общие HTTP/API ошибки остаются в privacy-safe логах Render.

Архитектурные границы:

- web доверяет только API, а не localStorage как источнику истины;
- DB доступна только server repositories и migration tool;
- AI объясняет, но не решает;
- cron запускает работу, но не получает bot token или DB credentials;
- billing включается только конфигурацией и ручным разрешением;
- новое хранилище, очередь или внешний сервис требуют Spec Kit и ADR.
