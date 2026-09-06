# Исследование

## Сопоставимость

**Решение**: comparison group включает experiment group, wake context и duration budget.

**Причина**: результат двухминутного и десятиминутного назначения нельзя приписать одному фактору.

## Feedback

**Решение**: отдельная idempotent user-scoped запись после пяти полных сессий.

**Причина**: feedback является персональными данными и не может смешиваться с raw session observations.
