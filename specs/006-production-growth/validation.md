# Валидация production growth Prosnix

Дата проверки: 1 сентября 2026 года.

## Проверено автоматически

- `pnpm format:check`, typecheck и unit/contract tests;
- все миграции с нуля в отдельной PostgreSQL `awc_growth_test_20260901_final`;
- 11 PostgreSQL integration tests, включая legal cascade delete, admin SQL, первое списание,
  повтор update, автоматическое продление и отмену автопродления;
- production build, лимит начального JavaScript bundle и отсутствие server secrets в web bundle;
- mobile Chromium E2E сценарии;
- production dependency audit.

## Безопасный rollout

- миграция forward-only и не удаляет существующие поля или данные;
- billing остаётся выключенным при `TELEGRAM_STARS_MONTHLY_PRICE=0`;
- без webhook secret, Web App URL и ID владельца сервер не разрешает включить Stars;
- старый deploy может работать после миграции, так как новые таблицы для него необязательны;
- откат приложения выполняется предыдущим Render deploy без отката схемы.

## Внешний production gate

Перед реальными продажами остаются ручные действия: реальные реквизиты оператора, проверка
уведомлений и трансграничной передачи, Telegram test environment, webhook нового бота, тест
продления, отмены, поддержки и ручного возврата Stars.
