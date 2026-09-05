# HTTP-контракты

## GET /api/v1/analytics/profile

Ответ сохраняет существующие поля и добавляет `dailyTrend`: массив точек с `localDate`, `averageDelta`, `evidenceCount` и собственными `sessionIds`. Точки отсортированы по дате по возрастанию и строятся только из парных завершённых наблюдений.

## POST /api/v1/coach/insight

Аутентификация: существующая HttpOnly Telegram session cookie. Тело отсутствует. GET больше не используется клиентом и возвращает 404.

Ответ сохраняет insight и добавляет `source` (`provider`, `cache`, `fallback`), `limitReached` и `refreshAvailableAt`. При недостатке данных или ошибке provider используется `source=fallback`; исходные метрики не меняются.

## PUT /api/v1/sessions/:sessionId/steps/:stepIndex

Тело получает обратно совместимое optional поле `difficultyLevel`: integer 1–3. Математика передаёт `correct=3`, а `total` содержит фактическое число попыток.
