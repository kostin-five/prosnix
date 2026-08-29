# Модель данных: Telegram-напоминания о пробуждении

## WakeSchedule

Одно ежедневное расписание подтверждённого пользователя.

| Поле            | Тип            | Правило                                                        |
| --------------- | -------------- | -------------------------------------------------------------- |
| user_id         | UUID           | PK и FK users; одно расписание на пользователя; cascade delete |
| local_time      | string         | `HH:mm`, 00:00–23:59                                           |
| timezone        | string         | действующий IANA timezone                                      |
| enabled         | boolean        | выключенное расписание не выдаётся worker                      |
| next_trigger_at | timestamp/null | UTC; обязателен для enabled                                    |
| bot_status      | enum           | unknown, available, blocked                                    |
| revision        | integer        | положительная версия настройки                                 |
| created_at      | timestamp      | серверное время                                                |
| updated_at      | timestamp      | серверное время                                                |

Переходы: отсутствует → enabled/disabled; enabled → changed/disabled; disabled → enabled/changed.
Любое изменение времени/timezone увеличивает revision и пересчитывает next_trigger_at.

## NotificationDelivery

Одна попытка конкретного срабатывания расписания.

| Поле                | Тип            | Правило                                                |
| ------------------- | -------------- | ------------------------------------------------------ |
| id                  | UUID           | PK                                                     |
| schedule_user_id    | UUID           | FK WakeSchedule; cascade delete                        |
| scheduled_for       | timestamp      | канонический UTC-момент                                |
| status              | enum           | sending, retry_wait, sent, blocked, ambiguous, skipped |
| attempts            | integer        | 1–2; второй запуск только после явного 429             |
| retry_at            | timestamp/null | только для retry_wait                                  |
| telegram_message_id | bigint/null    | только после успеха                                    |
| error_code          | string/null    | безопасная классификация, без тела ответа              |
| created_at          | timestamp      | серверное время                                        |
| updated_at          | timestamp      | серверное время                                        |
| sent_at             | timestamp/null | время подтверждённого успеха                           |

Уникальность `(schedule_user_id, scheduled_for)` исключает две логические доставки одного
срабатывания. `sending`, `sent`, `blocked`, `ambiguous`, `skipped` повторно не выдаются worker.

## Правила удаления и хранения

- Удаление пользователя каскадно удаляет расписание и доставки.
- Журнал доставок не содержит текстов сессий или initData.
- Срок хранения журнала для MVP — 90 дней; автоматическая очистка добавляется до публичной beta.
- Изменение расписания не переписывает уже завершённые доставки.
