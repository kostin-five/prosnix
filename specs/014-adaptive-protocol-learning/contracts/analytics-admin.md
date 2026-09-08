# Контракты analytics и admin

## `GET /api/v1/analytics/profile`

Сохраняет текущие агрегаты и добавляет:

```text
methodVersion: "analytics-v2"
comparisonProgress: Array<{
  key, factorKey, groupKey,
  withCount, withoutCount, pairCount,
  targetPairs: 3,
  status: "collecting" | "ready"
}>
```

`averageDelta`, `riseSuccess` и `sequenceEffects` являются содержательной общей частью профиля и
показываются после семи сессий независимо от `factorEffects`.

## `GET /api/v1/admin/growth?days=7|30|90`

В `retention` добавляется независимый агрегат:

```text
secondSessionWithin7Days: {
  cohort: number,
  eligible: number,
  returned: number,
  pending: number,
  rate: number
}
```

Существующие `retention.d1` и `retention.d7` не меняют семантику. Ответ не содержит user/session IDs
или времён отдельных людей.
