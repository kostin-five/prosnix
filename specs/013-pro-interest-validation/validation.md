# Валидация 0.4

**Дата**: 7 сентября 2026 года

## Выполнено

- На отдельной PostgreSQL 17 `localhost:55433` migrations `0000–0008` применились; затем
  `DATABASE_URL=postgres://awc:awc@localhost:55433/awc pnpm verify:release:full` — зелёный:
  15 PostgreSQL integration, 77 unit/contract и 15 mobile Chromium E2E, а также format, typecheck,
  build, bundle/security boundaries и dependency audit.
- Initial JavaScript: 239,4 КиБ из лимита 240 КиБ; карточки и справка статистики находятся в
  отдельном lazy chunk.

## Не выполнено

- Независимая проверка закрытых GitHub Actions, Render SHA и Neon из среды разработчика.

## Подтверждено владельцем после выпуска

- 7 сентября 2026 года владелец сообщил, что release-процедура, production migration и smoke-test
  работают.
- Подтверждение не раскрывает secrets или пользовательские данные и не заменяет внешний audit trail
  точного SHA в GitHub/Render.

## Риски

- Данные интереса — ранний качественный сигнал, а не готовность платить и не разрешение включать
  Stars/цену.
- Migration `0008` forward-only; её production-применение подтверждено владельцем, но не проверено
  разработчиком напрямую через закрытые Neon/Render.

## Repair admin enum, 7 сентября 2026 года

- По privacy-safe Render log определена причина `500`: production enum `subscription_status` не
  принимал литерал `past_due` в admin billing aggregate.
- Добавлена forward-only migration `0009_subscription_status_repair` с `ADD VALUE IF NOT EXISTS`;
  migration `0004` не изменялась.
- Admin query сравнивает `status::text`, поэтому ранняя схема не обрушает весь aggregate до repair.
- На отдельной PostgreSQL 17 `localhost:55434` полная цепочка `0000–0009` применилась с нуля.
- PostgreSQL regression применил repair дважды к fixture enum без `past_due` и подтвердил итоговый
  порядок значений; отдельный fixture подтвердил учёт действующей `past_due` подписки.
- `pnpm verify:release:full` зелёный: 17 integration, 79 API unit/contract, 26 domain unit,
  21 web unit/component и 16 mobile Chromium E2E; audit не нашёл известных уязвимостей.
- Initial JavaScript: 238,3 КиБ из лимита 240 КиБ.

Production/Neon migration, CI точного SHA, Render deploy и ручной Telegram smoke-test не выполнялись.

## Выключенный billing и legacy schema drift, 7 сентября 2026 года

- После выпуска `833134b` enum-ошибка исчезла; следующий безопасный Render log показал независимую
  причину `500`: отсутствует relation `telegram_star_payments`.
- Production composition теперь передаёт server-side billing flag в admin repository. При
  `TELEGRAM_STARS_MONTHLY_PRICE=0` запросы к обеим billing tables не выполняются, aggregates равны
  нулю. При включённой оплате ошибки неполной схемы не скрываются.
- Unit regression проверяет ровно 13 основных SQL-вызовов вместо 15 и нулевые billing aggregates.
- Повторный `pnpm verify:release:full` на отдельной PostgreSQL 17 зелёный: 17 integration, 80 API,
  26 domain, 21 web и 16 mobile Chromium E2E; audit без известных уязвимостей.
- Disposable контейнер, сеть и test volume удалены после проверки.

Новый production deploy и ручной Telegram smoke-test ещё не выполнялись. Перед будущим включением
Stars требуется отдельный audit отсутствующих billing relations; текущий fix не включает оплату.
