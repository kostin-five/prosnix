# Валидация: Релизное усиление MVP

**Дата:** 31 августа 2026 года  
**Ветка:** `dev`

## Подтверждено автоматически

- `pnpm audit --prod --audit-level high` — известных production-уязвимостей нет; до исправления
  аудит находил 13 advisory, включая 7 high.
- `pnpm verify:release` — форматирование, типы, unit/contract, сборка, бюджет и production boundaries
  прошли одной командой.
- API: 47 тестов пройдено; добавлены contract-тесты readiness, headers, no-store, body/rate limits и
  unit-тесты повторного graceful shutdown/deadline.
- Domain: 15 тестов пройдено; web: 4 component/accessibility теста пройдено.
- На отдельной чистой PostgreSQL 17 применены все миграции и пройдено 9 из 9 integration-тестов
  после обновления Drizzle ORM до 0.45.2.
- `pnpm test:e2e` — 8 из 8 mobile Chromium сценариев пройдено.
- `pnpm build` — все workspace-пакеты собраны; первоначальный JS 239,85 КБ / 71,37 КБ gzip,
  проверяемый размер 234,2 КиБ при лимите 250 КиБ.
- `pnpm verify:production` — серверные секреты и test fixtures не обнаружены в web bundle.
- `.github/workflows/ci.yml` и `.github/dependabot.yml` синтаксически валидны как YAML;
  `git diff --check` не нашёл повреждённых пробелов.

## Подтверждённые свойства

- `/health` остаётся дешёвой liveness-проверкой.
- `/ready` отвечает 200 только после успешной ограниченной проверки PostgreSQL и нейтральным 503
  без внутренних данных при ошибке/timeout.
- SIGTERM/SIGINT используют один shutdown promise; повторный сигнал не закрывает ресурсы повторно,
  deadline приводит к аварийному завершению вместо зависшего deploy.
- API получает защитные HTTP-заголовки и `Cache-Control: no-store`.
- Тело ограничено 32 КиБ, Telegram `initData` — 8 КиБ; auth и Coach имеют независимые лимиты.
- Неиспользуемый `react-router` удалён, Drizzle обновлён точечно; доменная модель и БД не менялись.
- CI отменяет устаревший запуск ветки, выполняет отдельный security audit и сохраняет Playwright
  report на пять дней только при ошибке.

## Ручные действия после deploy

1. В Render API изменить Health Check Path с `/health` на `/ready`.
2. В Static Site добавить rewrite `/ready` → `https://wake-coach.onrender.com/ready` перед `/*`.
3. После deploy проверить публичные `/health`, `/ready` и один Telegram wake-сценарий.
4. Убедиться, что GitHub jobs `verify` и `security` зелёные, а Render развёрнул нужный SHA.

Новая миграция не требуется. Временная тестовая БД удалена, основной Docker volume не удалялся.
