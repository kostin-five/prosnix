# Release checklist Prosnix

Отмечайте пункты для конкретного commit и среды. Успешный прошлый релиз не переносит отметки на
следующий.

## 1. Scope и review

- [ ] Есть утверждённая spec для material change или объяснение, почему это локальный bugfix/docs.
- [ ] Constitution check пройден; новые решения отражены в ADR.
- [ ] Нет незапланированных изменений API, schema, аналитики, legal version или billing.
- [ ] Roadmap и handoff обновлены по фактическому состоянию.
- [ ] В diff нет `.env`, secrets, user data, build artifacts или случайных debug logs.

## 2. Автоматические проверки

- [ ] `pnpm install --frozen-lockfile` проходит.
- [ ] Чистый `pnpm --filter @awc/web build` сначала собирает `@awc/domain` и не зависит от старого
      локального `packages/domain/dist`.
- [ ] `pnpm verify:release` проходит.
- [ ] `pnpm test:integration` проходит на disposable PostgreSQL 17.
- [ ] `pnpm audit --prod --audit-level high` не сообщает high/critical advisory.
- [ ] `pnpm test:e2e` проходит; failures/traces изучены.
- [ ] GitHub Actions `verify` и `security` зелёные для точного SHA.

## 3. Database

- [ ] Новая migration только forward-only и не меняет старые migration-файлы.
- [ ] Полная цепочка migrations применена с нуля.
- [ ] Repair migration `0009` проверена дважды на legacy enum без `past_due` и остаётся идемпотентной.
- [ ] Migration проверена на копии/тестовой базе и совместима с предыдущим API для rollback.
- [ ] Известны backup, окно восстановления и ответственный за production migration.
- [ ] Владелец явно разрешил production migration.

## 4. Конфигурация и безопасность

- [ ] Server secrets находятся только в Render API Environment.
- [ ] Static Site содержит только публичные `VITE_LEGAL_*` значения.
- [ ] `SESSION_SECRET`, `CRON_SECRET`, bot token и webhook secret не переиспользованы случайно.
- [ ] `ADMIN_TELEGRAM_USER_IDS` содержит числовой Telegram ID владельца или пуст для fail-closed.
- [ ] `/ready` выбран health check для API; `/health` используется только как liveness.
- [ ] HTTPS, no-store, secure cookie, body/rate limits и graceful shutdown не ослаблены.

## 5. Legal и billing gate

- [ ] В `/privacy` и `/terms` указаны реальные оператор и контакт; тексты проверены владельцем.
- [ ] URL политики указан в BotFather.
- [ ] При существенном изменении документов обновлены `LEGAL_*_VERSION`.
- [ ] Выполнены применимые уведомления/проверки обработки и трансграничной передачи данных.
- [ ] `TELEGRAM_STARS_MONTHLY_PRICE=0`, если отдельный billing launch не утверждён.
- [ ] При цене `0` admin не обращается к optional billing tables; перед ценой больше `0` подтверждена
      полная billing schema.
- [ ] Перед оплатой отдельно проверены Telegram test environment, support, cancel, renewal и refund.

Инженерный checklist не является юридическим заключением. Подробности:
[`legal-launch-checklist.md`](legal-launch-checklist.md).

## 6. Deploy

- [ ] Зафиксированы target environment, branch и полный commit SHA.
- [ ] Владелец явно разрешил deploy и все production mutations.
- [ ] Migration применяется до проверки нового API, но только после backup readiness.
- [ ] Render API deploy завершён без startup/config errors.
- [ ] Static Site deploy использует совместимый commit.
- [ ] Production `index.html` ссылается на asset новой сборки и имеет время публикации текущего
      релиза; API и Static Site подтверждены для одного SHA.
- [ ] Rewrites `/api/*`, `/health`, `/ready` направлены на актуальный API.
- [ ] cron-job.org и Telegram webhook не переключаются до готовности API.

## 7. Smoke после релиза

- [ ] `/health` возвращает `200 {"status":"ok"}`.
- [ ] `/ready` возвращает `200 {"status":"ready"}`.
- [ ] Mini App открывается из нужного бота и Telegram auth проходит.
- [ ] На ширине 320 px wordmark Prosnix Beta и счётчик сессий не пересекаются.
- [ ] Сессия создаётся, сохраняется, возобновляется и завершается.
- [ ] Сохранённую незавершённую сессию можно закрыть без продолжения; после повторного входа она не
      предлагается снова, а текущий Mini App остаётся открыт на главной.
- [ ] Analytics/history отражают новую сессию без внутренних UUID в UI.
- [ ] После 7+ завершённых сессий профиль объясняет эффект и устойчивость обычным языком, показывает
      `n`, лучший порядок, динамику отдельных сессий и свёрнутый progress проверок без причинных
      формулировок или технической строки confidence.
- [ ] Итог новой сессии использует общий серверный счётчик и не начинает обучение заново с «ещё 6».
- [ ] Два последовательных запуска не получают один exact protocol при наличии допустимой
      альтернативы; выбранный вариант соблюдает контекст, бюджет и анкету.
- [ ] Все задания используют единые иконки; световой/двигательный таймер видим и остаётся понятным с
      включённым reduced motion.
- [ ] Реакция заблокирована до сигнала и принимает одно касание; ошибки внимания и памяти не
      продвигают шаг до требуемого числа правильных ответов.
- [ ] Режим 10 минут показывает пять успешных раундов математики/внимания/реакции, три раунда памяти
      и увеличенные безопасные интервалы; 2/5 минут сохраняют базовые цели.
- [ ] При полном профиле режим 10 минут содержит семь разных шагов; ходьба или разминка идёт раньше
      приседаний, а ограниченный профиль не получает запрещённых заданий.
- [ ] Серия касаний завершённого шага отправляет один результат; conflict синхронизирует canonical
      session и оставляет доступным следующий или повторный шаг.
- [ ] Экран контекста объясняет, что первые назначения могут совпадать, а последующее evidence
      разделяется по контексту и бюджету.
- [ ] Дневная динамика совпадает с ручным средним парных оценок по локальным датам.
- [ ] Daily reminder, snooze и follow-up работают без дублей.
- [ ] Открытие статистики не вызывает DeepSeek; кнопка возвращает DeepSeek/cache/fallback и не создаёт второй provider-разбор в тот же локальный день.
- [ ] Privacy/terms доступны без auth; legal acceptance сохраняется.
- [ ] `/admin` доступен владельцу и скрыт от обычного пользователя.
- [ ] `/admin` показывает ручно сверенные cohort/eligible/returned/pending второй сессии за 7 дней.
- [ ] `/admin` загружает billing aggregate без `500`; при искусственной ошибке показывает только
      безопасный `requestId`.
- [ ] Render logs не содержат secrets или пользовательские ответы.

## 8. Rollback и завершение

- [ ] Определён предыдущий известный рабочий Render deploy.
- [ ] При rollback откатывается код, но не применённая forward-only schema.
- [ ] После rollback повторены `/health`, `/ready`, Telegram auth и session smoke.
- [ ] Инцидент/отклонение зафиксировано без секретов и персональных данных.
- [ ] Создан новый датированный handoff, `CURRENT.md` указывает на него.

Подробная эксплуатация и rollback: [`operations.md`](operations.md).
