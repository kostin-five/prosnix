# Модель данных

## Adaptive protocol evidence (вычисляемая, не новая таблица)

- `sequenceKey`: точный порядок task IDs после персонализации;
- `wakeContext`: контекст текущего пробуждения;
- `durationMinutes`: выбранный бюджет 2/5/10;
- `delta`: post-rating минус baseline;
- `followUp`: `up`, `back`, `drowsy` или null;
- `completedAt`: server timestamp для стабильного порядка.

Источник — существующие wake sessions, assignments, protocol definitions, ratings и follow-up.
Только завершённые с обеими оценками формируют outcome evidence.

## Adaptive candidate summary (доменный value object)

- versioned `protocolKey`, `strategyVersion=adaptive-v2`;
- фактические `steps` и `sequenceKey`;
- `evidenceCount`, `averageDelta`, `answeredFollowUps`, `followUpScore`;
- итоговый `score`, `confidence`, `selectionMode` и пользовательский `reason`.

Value object вычисляется при назначении и не создаёт нового mutable source of truth. Assignment
продолжает сохранять strategy version, hypothesis и evidence snapshot в существующих полях.

## Factor comparison progress (вычисляемый ответ)

- `key`, `factorKey`, `groupKey`;
- `withCount`, `withoutCount`, `pairCount`, `targetPairs=3`;
- `status`: `collecting` или `ready`.

## Pilot second-session return (admin aggregate)

- `cohort`: число пользователей с первой completed session в периоде;
- `eligible`: вернувшиеся в окно плюс пользователи с закрытым окном;
- `returned`: вторая completed session в интервале `(first, first + 7 days]`;
- `pending`: не вернувшиеся пользователи с ещё открытым окном;
- `rate`: вычисляется API как `returned / eligible`, при нуле равен 0.

Персональные строки не выходят из repository. Новая таблица или migration не требуются.
