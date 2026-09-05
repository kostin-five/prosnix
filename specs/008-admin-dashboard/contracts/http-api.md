# HTTP-контракт: Продуктовая админ-панель

## GET `/api/v1/admin/growth?days=7|30|90`

Требуется валидная `awc_session` cookie и соответствие Telegram ID серверному `ADMIN_TELEGRAM_USER_IDS`.

### Успех `200`

```json
{
  "period": { "days": 7, "from": "2026-08-29T12:00:00.000Z", "to": "2026-09-05T12:00:00.000Z" },
  "computedAt": "2026-09-05T12:00:00.000Z",
  "users": { "total": 42, "new": 8, "active": 11 },
  "sessions": { "started": 20, "completed": 15, "abandoned": 2, "completionRate": 0.75 },
  "funnel": {
    "assigned": 22,
    "started": 20,
    "completed": 15,
    "followedUp": 10,
    "startRate": 0.9091,
    "completionRate": 0.75,
    "followUpRate": 0.6667
  },
  "wakeQuality": {
    "pairedSessions": 15,
    "averageDelta": 2.4,
    "improvedSessions": 13,
    "improvedRate": 0.8667
  },
  "followUp": {
    "eligible": 15,
    "answered": 10,
    "responseRate": 0.6667,
    "up": 8,
    "back": 1,
    "drowsy": 1,
    "stayedUpRate": 0.8
  },
  "retention": {
    "d1": { "eligible": 8, "retained": 3, "rate": 0.375 },
    "d7": { "eligible": 4, "retained": 1, "rate": 0.25 }
  },
  "timeline": [
    { "date": "2026-09-05", "newUsers": 1, "startedSessions": 2, "completedSessions": 1 }
  ],
  "breakdowns": {
    "contexts": [{ "key": "night_sleep", "sessions": 10, "completed": 8, "completionRate": 0.8 }],
    "durations": [{ "minutes": 5, "sessions": 12, "completed": 9, "completionRate": 0.75 }]
  },
  "features": {
    "capabilityProfiles": 6,
    "routinesEnabled": 3,
    "routineRuns": 4,
    "routineRunsCompleted": 2,
    "aiInsightsGenerated": 5
  },
  "deliveries": {
    "dailySent": 6,
    "followUpSent": 5,
    "failed": 1,
    "blocked": 0,
    "terminal": 12,
    "successRate": 0.9167
  },
  "billing": { "enabled": false, "activeSubscriptions": 0, "grossStars": 0 }
}
```

Старые поля `sessions`, `followUp`, `retention`, `deliveries` и `billing` сохраняются обратно
совместимыми; `followUp` и `deliveries` расширяются новыми полями. Feature-агрегаты относятся к
выбранному периоду: завершённые анкеты считаются по `onboarding_completed_at`, новые включённые
рутины и их запуски — по `created_at`, AI-объяснения — по `generated_at`.

### Ошибки

- `400 { "error": "invalid_period" }` — другое значение `days`;
- `404 { "error": "not_found" }` — нет cookie, cookie неверна или пользователь не в allowlist;
- `429` — превышен rate limit.

Все ответы API имеют `Cache-Control: no-store`. В ответе запрещены Telegram ID, UUID пользователей/сессий, индивидуальные оценки, routine items и evidence IDs.
