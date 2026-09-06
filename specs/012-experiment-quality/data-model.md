# Модель данных

- `experiment_feedback`: user ID, полезность, раздражение, намерение продолжить, createdAt; одна запись на user и experiment version.
- Comparable group: factor key + experiment version + wake context + duration budget.

Migration будет только новой и forward-only.
