# Validation: качество экспериментов 0.3

## Проверено локально 7 сентября 2026 года

- `pnpm verify:release:full` — успешно: format, typecheck, 75 unit/contract tests,
  14 PostgreSQL integration tests, build, bundle/security checks, production audit и 14 mobile E2E.
- Integration выполнялись на отдельном disposable PostgreSQL 17 `localhost:55433`, после
  применения migrations `0000–0007` с нуля.
- Integration покрывает idempotent feedback после пяти completed sessions и каскадное удаление.
- Domain fixture фиксирует ручные expected values для sequence effects.
- Mobile E2E покрывает отображение sequence и одноразовый feedback.

## Остаётся перед выпуском

- Зелёный CI точного SHA.
- Ручной Telegram smoke-test и отдельное решение владельца о production release.
- Production migration, deploy, Render/Neon/Telegram/webhook/secrets не выполнялись.
