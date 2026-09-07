# Модель данных

## `pro_interest_responses`

| Поле             | Назначение                               | Ограничение                                                |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `id`             | технический UUID                         | primary key                                                |
| `user_id`        | владелец ответа                          | FK `users`, `on delete cascade`                            |
| `offer_version`  | фиксированная версия исследования        | `pro-interest-v1` для первого offer                        |
| `intent`         | степень интереса                         | `interested`, `not_now`, `not_interested`                  |
| `interest_focus` | полезное направление для positive intent | `long_history`, `deeper_experiments`, `both`, иначе `null` |
| `created_at`     | server timestamp                         | `not null`                                                 |

`unique(user_id, offer_version)` делает POST идемпотентным. Check constraint запрещает focus без
`interested` и запрещает `interested` без focus.

## Aggregate

`proInterest` возвращает только: `responses`, `interested`, `notNow`, `notInterested`,
`longHistory`, `deeperExperiments`, `both`. Нули возвращаются явно.

## Совместимость `subscription_status`

Актуальный enum содержит `active`, `canceled`, `past_due`, `expired`, `refunded`. Repair migration
только добавляет отсутствующее `past_due`; существующие значения и строки не переписываются.
