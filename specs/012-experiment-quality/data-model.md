# Модель данных

- `experiment_feedback`: user ID, версия feedback-опроса, полезность, раздражение, намерение
  продолжить, createdAt; одна запись на user и версию опроса.
- `experiment_assignments.strategyVersion`: неизменяемая версия стратегии каждого назначения;
  admin видит только агрегаты assigned/completed по этой версии.
- `CompletedSessionEvidence.sequenceKey`: точный порядок фактически выполненных task IDs;
  используется только для описательного sequence effect.
- Comparable group: factor key + comparison group + wake context + duration budget.

Migration будет только новой и forward-only.
