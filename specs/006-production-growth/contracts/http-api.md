# HTTP-контракты: Production growth Prosnix

Все ответы имеют `Cache-Control: no-store`. Пользовательские маршруты требуют `awc_session`.

## Legal

### `GET /api/v1/legal/status`

```json
{
  "privacyVersion": "2026-08-31",
  "termsVersion": "2026-08-31",
  "accepted": false,
  "acceptedAt": null
}
```

### `POST /api/v1/legal/accept`

```json
{ "privacyVersion": "2026-08-31", "termsVersion": "2026-08-31" }
```

Возвращает `204`; несовпадающая версия — `409 legal_version_changed`.

## Admin

### `GET /api/v1/admin/growth?days=7|30|90`

Требует Telegram session + allowlist. Ответ содержит только период, computedAt, агрегаты users, sessions, followUp, retention, deliveries и billing. Неавторизованный/неразрешённый запрос возвращает одинаковый `404 not_found`.

## Billing

### `GET /api/v1/billing/status`

```json
{
  "enabled": false,
  "plan": { "key": "pro-monthly-v1", "priceStars": null, "periodDays": 30 },
  "entitlement": { "status": "free", "currentPeriodEnd": null }
}
```

### `POST /api/v1/billing/checkout`

Тело `{}`. Требует актуальное legal acceptance и включённый тариф. Возвращает `invoiceUrl` и `expiresAt`. Продажи выключены — `409 billing_disabled`; документы не приняты — `409 legal_acceptance_required`.

### `POST /internal/telegram/webhook`

Требует `X-Telegram-Bot-Api-Secret-Token`. Поддерживает `pre_checkout_query`, первое и повторные
`message.successful_payment`, изменения `subscription`, а также команды `terms`, `privacy` и
`paysupport`. Подлинный update получает быстрый `200`; неподлинный — `401`.

## Публичные маршруты

- `GET /privacy` — политика Prosnix;
- `GET /terms` — пользовательское соглашение Prosnix;
- `GET /admin` — UI, данные защищены API allowlist.
