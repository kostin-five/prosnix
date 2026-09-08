# Validation: ясность перед пилотом

## Соответствие

- Spec, plan и tasks согласованы: все FR имеют реализацию и regression coverage.
- Новых API-контрактов, формул, persistence model, provider или migration нет.
- UI не скрывает размер выборки и не делает медицинских или причинных утверждений.
- График использует только разрешённую server history и не расширяет AI payload.

## Проверено локально

- web unit/component: 24 успешно;
- API unit/contract: 67 успешно, 14 DB-dependent пропущены без тестовой PostgreSQL;
- TypeScript strict: успешно;
- production build: успешно;
- initial web bundle: 240,0 КиБ из лимита 240 КиБ;
- mobile Chromium E2E: 17 успешно;
- `pnpm verify:release`: успешно (format, strict types, 120 unit/contract tests, build, bundle и
  production boundaries).

## Не проверено

- реальный Telegram iOS/Android/Desktop после deploy;
- GitHub CI точного будущего SHA;
- production deploy и внешние сервисы не изменялись.

## Риски

- initial bundle находится ровно у лимита, поэтому дальнейшие синхронные UI-зависимости требуют
  выделения chunk или уменьшения основного entry;
- лучший порядок остаётся наблюдаемым сигналом, а не доказательством причинности;
- AI provider может вернуть fallback, но fallback теперь даёт конкретную проверку по агрегатам.
