# HTTP-контракт: Pro interest

## `GET /api/v1/pro-interest`

Требует существующую аутентификацию Telegram Mini App.

```json
{ "eligible": true, "submitted": false }
```

`eligible` считается по completed sessions и отсутствию response версии `pro-interest-v1`.

## `POST /api/v1/pro-interest`

Требует существующую аутентификацию. Body:

```json
{ "intent": "interested", "interestFocus": "both" }
```

Для `not_now` / `not_interested` `interestFocus` отсутствует. При недостаточном опыте API возвращает
`409 { "code": "pro_interest_not_eligible" }`. Повторный допустимый POST возвращает saved status и
не создаёт вторую строку.

## Admin aggregate

Действующий `/api/v1/admin/growth` содержит:

```json
{
  "breakdowns": {
    "proInterest": {
      "responses": 0,
      "interested": 0,
      "notNow": 0,
      "notInterested": 0,
      "longHistory": 0,
      "deeperExperiments": 0,
      "both": 0
    }
  }
}
```

Admin endpoint также остаётся доступным при чтении ранней схемы `subscription_status` без
`past_due`. При серверной ошибке ответ содержит безопасный `requestId`, который UI показывает
владельцу для поиска события в server logs; персональные данные в него не включаются.
