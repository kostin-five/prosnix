# Контракты аналитики и wake flow

## GET /api/v1/analytics/profile

Shape сохраняется. `protocolEffects.value` доступен с первой полной сессии; `confidence` и `evidenceCount` обязательны для интерпретации.

## POST /api/v1/coach/insight

Shape сохраняется. `source: fallback` с валидным `insight` отображается как «Базовый расчёт по данным».

## POST /api/v1/sessions

Shape сохраняется. Назначение допустимо профилю, учитывает duration budget и отличается от предыдущего при доступной альтернативе.
