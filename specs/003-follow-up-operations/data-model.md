# Модель данных: Follow-up и эксплуатационная надёжность

## FollowUpNotificationDelivery

Одно техническое напоминание по конкретной завершённой wake-сессии.

| Поле                | Тип            | Правило                                                        |
| ------------------- | -------------- | -------------------------------------------------------------- |
| id                  | UUID           | первичный ключ                                                 |
| session_id          | UUID           | уникальный FK wake_sessions; cascade delete                    |
| user_id             | UUID           | FK users; cascade delete                                       |
| scheduled_for       | timestamp      | канонический `follow_up_due_at`                                |
| status              | enum           | sending, retry_wait, sent, blocked, ambiguous, failed, skipped |
| attempts            | integer        | 1–2                                                            |
| retry_at            | timestamp/null | только для retry_wait                                          |
| telegram_message_id | bigint/null    | только после подтверждённого успеха                            |
| error_code          | string/null    | безопасная категория без Telegram body                         |
| created_at          | timestamp      | серверное время                                                |
| updated_at          | timestamp      | серверное время                                                |
| sent_at             | timestamp/null | время подтверждённого успеха                                   |

Переходы: создание → sending/skipped; sending → sent/retry_wait/blocked/ambiguous/failed/skipped;
retry_wait → sending → terminal. Terminal состояния повторно не выдаются.

## NotificationClaimBatch

Результат атомарного claim одного типа доставки: список зарезервированных сообщений, число
пропущенных и максимальная задержка относительно `scheduled_for`.

## NotificationRunSummary

Эфемерная privacy-safe сводка HTTP-запуска: отдельные итоги wake/follow-up, сумма, количество
удалённых журналов, длительность и максимальная задержка. Не хранит идентификаторы пользователей.

## Правила хранения и удаления

- Обе delivery-таблицы очищаются по `created_at < now - 90 дней`.
- Wake-сессии, observations и analytics projections очисткой не затрагиваются.
- Удаление пользователя каскадно удаляет follow-up delivery через `user_id`/`session_id`.
- Повтор cleanup после частичного или полного выполнения безопасен.
