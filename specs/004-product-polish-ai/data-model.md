# Модель данных: Надёжный UX и AI Wake Coach

## CoachInsight

Одна актуальная AI-карточка пользователя.

| Поле                 | Тип       | Правило                                       |
| -------------------- | --------- | --------------------------------------------- |
| user_id              | UUID      | PK/FK users, cascade delete                   |
| evidence_fingerprint | string    | SHA-256 канонического агрегированного payload |
| summary              | string    | 1–400 символов, наблюдение без диагноза       |
| next_experiment      | string    | 1–300 символов, проверяемое действие          |
| caveat               | string    | 1–300 символов, ограничение выборки           |
| model                | string    | фактически использованная модель              |
| evidence_count       | integer   | число полных сессий на момент генерации       |
| generated_at         | timestamp | серверное время                               |
| updated_at           | timestamp | серверное время upsert                        |

При новом fingerprint строка заменяется. Удаление пользователя каскадно удаляет вывод.

## CoachAggregatePayload

Эфемерный allow-list объект для внешней модели: methodVersion, averageDelta, riseSuccess,
protocolEffects и factorEffects. Каждая метрика содержит только безопасный key, value,
evidenceCount и confidence. UUID, timestamps сессий и идентичность отсутствуют.

## SessionHistoryItem

Read model завершённой сессии: публичный session key для клиентского React key, дата завершения,
baseline/post rating, длительность протокола, список taskId/category и follow-up outcome. Endpoint
возвращает только владельцу. UI не отображает внутренний key.

## WakeSchedule snooze

Новая сущность не создаётся. Существующие `local_time` и `timezone` остаются ежедневным правилом,
а `next_trigger_at` становится ближайшим snooze-моментом. Revision увеличивается, повторная доставка
использует существующий уникальный delivery key.
