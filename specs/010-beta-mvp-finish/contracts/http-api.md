# HTTP-контракт: персональный отчёт Beta

## POST `/api/v1/coach/insight`

Требует действующую server session cookie.

### Тело

```json
{
  "confirmEarly": false
}
```

Тело — JSON, поле optional, дополнительные поля запрещены.

### Ответ до трёх наблюдений

```json
{
  "status": "confirmation_required",
  "evidenceCount": 2,
  "cached": false,
  "source": "fallback",
  "limitReached": false,
  "refreshAvailableAt": "2026-09-06T21:00:00.000Z",
  "insight": null
}
```

Статусы: `ready | confirmation_required | unavailable`.

- `confirmation_required`: provider не вызван; повтор возможен с `confirmEarly: true`.
- `ready`: provider или валидный cache.
- `unavailable`: полезный deterministic report, когда provider не настроен/недоступен.

Дневной лимит, кэш и fingerprint действуют одинаково для обычного и подтверждённого раннего отчёта.
