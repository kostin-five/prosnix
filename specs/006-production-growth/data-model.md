# Модель данных: Production growth Prosnix

## `legal_acceptances`

| Поле              | Тип         | Правило         |
| ----------------- | ----------- | --------------- |
| `user_id`         | UUID PK/FK  | cascade delete  |
| `privacy_version` | text        | непустая версия |
| `terms_version`   | text        | непустая версия |
| `accepted_at`     | timestamptz | server time     |
| `updated_at`      | timestamptz | server time     |

Запись актуальна, когда обе версии равны текущей server config.

## `billing_checkouts`

| Поле          | Тип                  | Правило                       |
| ------------- | -------------------- | ----------------------------- |
| `id`          | UUID PK              | случайный payload invoice     |
| `user_id`     | UUID FK              | cascade delete, indexed       |
| `plan_key`    | text                 | `pro-monthly-v1`              |
| `price_stars` | integer              | > 0                           |
| `status`      | enum                 | pending/paid/expired/canceled |
| `invoice_url` | text nullable        | только Telegram URL           |
| `created_at`  | timestamptz          | server time                   |
| `expires_at`  | timestamptz          | created + 15 минут            |
| `paid_at`     | timestamptz nullable | только при successful payment |

Переходы: `pending -> paid`; `pending -> expired/canceled`. `paid` терминален.

## `subscriptions`

| Поле                         | Тип         | Правило                                   |
| ---------------------------- | ----------- | ----------------------------------------- |
| `user_id`                    | UUID PK/FK  | cascade delete                            |
| `plan_key`                   | text        | versioned entitlement                     |
| `status`                     | enum        | active/canceled/past_due/expired/refunded |
| `price_stars`                | integer     | > 0                                       |
| `telegram_payment_charge_id` | text unique | support/refund                            |
| `current_period_end`         | timestamptz | Telegram source of truth                  |
| `created_at`                 | timestamptz | server time                               |
| `updated_at`                 | timestamptz | server time                               |

Активный доступ до конца оплаченного периода сохраняется для `active`, `canceled` и `past_due`.
Статус `canceled` означает отключённое автопродление, а `past_due` — неуспешное последнее
продление.

## `telegram_star_payments`

| Поле                         | Тип           | Правило                         |
| ---------------------------- | ------------- | ------------------------------- |
| `telegram_payment_charge_id` | text PK       | один факт списания              |
| `update_id`                  | bigint unique | защита от повторного update     |
| `checkout_id`                | UUID FK       | исходная подписка               |
| `user_id`                    | UUID FK       | cascade delete                  |
| `amount_stars`               | integer       | больше нуля                     |
| `paid_at`                    | timestamptz   | Telegram successful payment     |
| `period_end`                 | timestamptz   | новый конец оплаченного периода |
| `is_recurring`               | boolean       | первое списание или продление   |

Каждое продление создаёт новую строку. Админская gross Stars считается по этому журналу, а не по
checkout, поэтому повторный update не завышает выручку.

## `telegram_payment_updates`

| Поле           | Тип         | Правило                  |
| -------------- | ----------- | ------------------------ |
| `update_id`    | bigint PK   | Telegram idempotency key |
| `event_type`   | text        | allowlisted type only    |
| `processed_at` | timestamptz | server time              |

Raw update, user ID и платёжные реквизиты не сохраняются.

## Вычисляемая `AdminGrowthSummary`

- период и `computedAt`;
- total/new/active users;
- sessions started/completed/abandoned и completion rate;
- follow-up answered/up/back/drowsy;
- D1/D7 numerator/denominator/rate;
- daily/follow-up deliveries sent/failed/blocked;
- active subscriptions и gross Stars.

Ответ не содержит строк по пользователям, Telegram ID или session UUID.

## Удаление

Удаление `users` каскадно удаляет acceptance, checkout, subscription и платёжный журнал пользователя.
Обработанные update ID не имеют user FK и хранятся только для дедупликации.
