# Стратегия тестирования Prosnix

## Цель

Тесты защищают источник истины: Telegram identity, session state, исходные наблюдения,
экспериментальные формулы, уведомления, legal acceptance и платежные события. Количество тестов само
по себе не является критерием готовности.

## Перед запуском

- Node.js 22–24 и pnpm 11.19.0;
- зависимости установлены через `pnpm install --frozen-lockfile`;
- для integration — отдельная PostgreSQL 17 с применёнными migrations;
- production/staging `DATABASE_URL` использовать запрещено;
- для E2E установить Chromium: `pnpm exec playwright install chromium`.

## Уровни

| Уровень        | Где                                                | Что проверяет                                               |
| -------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Domain unit    | `packages/domain/tests`                            | state machine, adaptive selector, analytics, timezone       |
| API contract   | `apps/api/tests/contract`                          | auth boundary, schemas, status codes, headers, rate limits  |
| Adapter unit   | `apps/api/tests/coach`, `notifications`, `runtime` | DeepSeek/Telegram mapping, fallback, dispatch, shutdown     |
| DB integration | `apps/api/tests/integration`                       | migrations, transactions, constraints, concurrency, cascade |
| Web component  | `apps/web/tests`                                   | tasks/legal/admin/settings UX и accessibility               |
| Mobile E2E     | `tests/e2e`                                        | critical journey в mobile Chromium                          |
| Static checks  | `scripts/verify-*`                                 | initial bundle и отсутствие server/test secrets в web build |

## Команды

Быстрый цикл:

```bash
pnpm format:check
pnpm typecheck
pnpm test
```

Сборка и production boundaries:

```bash
pnpm build
pnpm verify:web-bundle
pnpm verify:production
pnpm audit --prod --audit-level high
```

Интеграционные тесты:

```bash
pnpm db:start
pnpm db:migrate
pnpm test:integration
```

E2E:

```bash
pnpm test:e2e
```

Обязательный набор перед обычным merge:

```bash
pnpm verify:release
```

Полный release candidate при запущенной тестовой БД:

```bash
pnpm verify:release:full
```

## Правила добавления тестов

- Исправление бага сначала получает regression test на самом дешёвом надёжном уровне.
- Новая доменная формула получает фиксированный fixture и ручной ожидаемый результат.
- Adaptive selection проверяется на детерминизм, isolation контекста/бюджета, exploration,
  повторную проверку лучшего и запрет непосредственного exact-repeat.
- Пилотный возврат проверяется на границе ровно семи суток и отдельно учитывает pending-когорту.
- Новая запись API проверяет отсутствие idempotency key, повтор запроса и конфликт версии.
- Новая персональная выборка проверяет isolation двух пользователей и каскадное удаление.
- Новая внешняя интеграция проверяет timeout, некорректный ответ, повтор и безопасный fallback.
- Изменение critical flow обновляет хотя бы один mobile E2E smoke.
- Не закреплять внутреннюю реализацию, если пользовательский контракт можно проверить напрямую.

## PostgreSQL

Integration tests должны выполняться на disposable database. Безопасный вариант — локальный контейнер
из `compose.yaml`. Перед использованием удалённой тестовой БД проверьте имя хоста и базы вручную.
Миграции тестируются с нуля и повторным запуском. Нельзя редактировать уже выпущенные SQL-файлы ради
прохождения теста; создайте следующую migration.

## CI

`.github/workflows/ci.yml` запускается для pull request и push в `master`/`dev`:

- job `verify`: PostgreSQL 17, install, format, typecheck, migrate, unit/contract, integration,
  build, bundle/security boundaries и mobile Chromium E2E;
- job `security`: production dependency audit;
- при E2E-ошибке сохраняются Playwright report и traces;
- новый push отменяет устаревший CI того же ref.

Красный обязательный job блокирует merge. Локальный успех не заменяет CI.

## Ручной smoke-test

Автоматизация не заменяет проверку внутри Telegram:

1. новый вход и legal gate;
2. старт, закрытие Mini App и продолжение активной сессии;
3. baseline, все задания, post-rating и результат;
4. follow-up из Telegram через 15 минут;
5. расписание и snooze;
6. история, профиль после 7+ сессий, лучший порядок и progress factor pairs;
7. отсутствие AI-вызова до кнопки, AI fallback/ответ и дневной лимит;
8. отсутствие immediate repeat при доступной альтернативе и соответствие задания бюджету/анкете;
9. удаление тестового профиля;
10. `/admin` разрешённому и обычному пользователю, включая second-session rate и pending;
11. при billing rollout — checkout, renewal, cancel, support и refund в test environment.

Устройства: Telegram iOS, Android и Desktop. Сейчас Android остаётся ручным пробелом; mobile Chromium
покрывает layout/flow, но не заменяет Telegram Android WebView.

Последний подтверждённый прогон описан в validation-файле актуальной спецификации, на которую
указывает `.specify/feature.json`.
