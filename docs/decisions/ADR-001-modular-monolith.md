# ADR-001: Модульный монолит с общим доменным ядром

- **Статус:** принято
- **Дата:** 2026-08-27
- **Последняя проверка:** 2026-09-01

## Контекст

Prosnix начинался как Figma-прототип Telegram Mini App. Для production MVP нужны серверная проверка
Telegram identity, надёжные wake-сессии, PostgreSQL, экспериментальная аналитика, уведомления, AI и
платежная основа. Команда и бюджет малы; преждевременные микросервисы увеличили бы стоимость deploy,
наблюдаемости, транзакций и локальной разработки.

При этом доменные правила нельзя связывать с React, Fastify, Drizzle, Telegram или Render: продукту
нужно менять UX и инфраструктуру без переписывания экспериментального ядра.

## Решение

Использовать pnpm/TypeScript модульный монолит:

- `apps/web` — клиент;
- `apps/api` — единая server runtime и composition root;
- `packages/domain` — чистые модели, переходы и repository ports;
- `packages/contracts` — общие transport schemas;
- `packages/db` — PostgreSQL adapters и migrations.

Один API-процесс обслуживает HTTP, auth, analytics, AI, notifications и billing. Фоновый запуск
инициируется внешним cron, но reservation/state остаются в PostgreSQL. Внешние сервисы подключаются
через gateways. Межмодульные транзакции выполняются внутри одного Unit of Work.

## Последствия

Плюсы:

- один deploy и одна база для дешёвого MVP;
- атомарные session/payment/notification transitions;
- быстрые integration tests;
- domain можно переиспользовать в другом клиенте или adapter;
- ясные security boundaries без сетевого взаимодействия между внутренними модулями.

Минусы:

- масштабирование модулей по отдельности невозможно;
- in-process lock dispatch не координирует несколько API instances;
- ошибка процесса затрагивает все backend-функции;
- дисциплина imports и ports обязательна, иначе монолит станет связанным.

## Отклонённые варианты

- **Только frontend/localStorage:** не обеспечивает identity, recovery между устройствами и честный
  source of truth.
- **Backend-as-a-Service напрямую из клиента:** ослабляет ownership, transition и payment boundaries.
- **Микросервисы/очередь сейчас:** не подтверждены нагрузкой и требуют лишних ресурсов/операций.
- **AI как orchestrator:** делает состояние и аналитику невоспроизводимыми.

## Когда пересмотреть

ADR пересматривается, если появляется несколько API instances, независимая нагрузка notification
worker, отдельная команда/релизный цикл модуля или измеримое ограничение одной PostgreSQL/runtime.
Переход требует новой спецификации, migration/rollback плана и следующего ADR.
