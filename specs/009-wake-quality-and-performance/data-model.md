# Модель данных

## TaskObservation

- Существующие поля: session, protocol step, task, category, correct, total, duration, observed time.
- Новое поле `difficultyLevel`: nullable integer 1–3.
- Для старых и некогнитивных результатов значение `null` допустимо.
- `correct <= total`; математика нового формата сохраняет `correct = 3`, `total = фактическое число попыток`.

## CompletedSessionEvidence

- Дополняется `completedAt` и `wakeContext` для построения временного ряда.
- Исходные baseline/post остаются неизменными.

## DailyWakeTrendPoint

- `localDate`: дата `YYYY-MM-DD` в часовом поясе пользователя.
- `averageDelta`: среднее парных изменений за дату.
- `evidenceCount`: число вошедших сессий.
- `sessionIds`: собственные evidence IDs для связывания с деталями; не используются как публичная админ-метрика.

## CoachInsightResponse

- Существующие: status, evidenceCount, insight.
- `source`: `provider`, `cache` или `fallback`.
- `limitReached`: достигнут ли дневной лимит нового provider-вызова.
- `refreshAvailableAt`: следующая локальная полночь в ISO.
- Кэш остаётся одной последней записью пользователя; `generatedAt` определяет дневную квоту.

## Переходы

- Task difficulty не меняет state machine сессии.
- Неверный ответ остаётся внутри клиентского задания и не создаёт task observation до финального результата.
- AI POST не меняет wake-сессию или исходные наблюдения.
