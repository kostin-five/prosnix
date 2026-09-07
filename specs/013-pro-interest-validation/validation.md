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

- CI точного SHA, ручной Telegram smoke-test и любое production действие.

## Риски

- Данные интереса — ранний качественный сигнал, а не готовность платить и не разрешение включать
  Stars/цену.
- Migration `0008` forward-only и не применялась в Neon/production.
