# Модель данных: Продуктовая админ-панель

Новых сохраняемых сущностей нет. Все сущности ниже вычисляются при чтении.

## AdminDashboardSummary

- `period`: days, from, to;
- `computedAt`;
- `users`: total, new, active;
- `funnel`: assigned, started, completed, followedUp и коэффициенты переходов;
- `wakeQuality`: pairedSessions, averageDelta, improvedSessions, improvedRate;
- `followUp`: eligible, answered, responseRate, up, back, drowsy, stayedUpRate;
- `retention`: D1 и D7 с eligible, retained, rate;
- `timeline`: не более 90 `DailyPoint`;
- `breakdowns`: context и duration;
- `features`: завершённые анкеты, созданные включённые рутины, запуски/завершения рутины и
  AI-объяснения внутри периода;
- `deliveries`: dailySent, followUpSent, failed, blocked, terminal, successRate;
- `billing`: enabled, activeSubscriptions, grossStars.

## CohortFunnel

Сессия входит в когорту, если `createdAt` находится в `[from, to)`.

- `assigned`: все сессии когорты;
- `started`: `startedAt` существует и меньше `to`;
- `completed`: `protocolCompletedAt` существует и меньше `to`;
- `followedUp`: связанный follow-up существует и `observedAt < to`;
- `startRate = started / assigned`;
- `completionRate = completed / started`;
- `followUpRate = followedUp / completed`.

При нулевом знаменателе rate равен 0.

## WakeQuality

Сессия учитывается только при наличии baseline и post-protocol rating.

- `delta = post - baseline`;
- `averageDelta`: среднее delta, округлённое до двух знаков, либо `null` без пар;
- `improvedSessions`: число delta больше 0;
- `improvedRate`: improvedSessions / pairedSessions.

## DailyPoint

- `date`: календарная дата UTC в формате `YYYY-MM-DD`;
- `newUsers`: пользователи, созданные в этот день;
- `startedSessions`: сессии когорты со стартом в этот день;
- `completedSessions`: сессии когорты с завершением в этот день.

Дни без событий присутствуют с нулями.

## Breakdown

### ContextBreakdown

- `key`: `unspecified`, `night_sleep`, `short_nap`, `long_nap`, `energy_reset`;
- `sessions`;
- `completed`;
- `completionRate`.

### DurationBreakdown

- `minutes`: 2, 5 или 10;
- `sessions`;
- `completed`;
- `completionRate`.

## Источники истины

- users: `users`;
- session funnel/context/duration: `wake_sessions`;
- quality: `rating_observations` + `wake_sessions`;
- follow-up: `follow_up_observations` + когортные sessions;
- routine: `wake_capability_profiles`, `wake_routines`, `wake_routine_runs`;
- AI: `coach_insights`;
- delivery: `notification_deliveries`, `follow_up_notification_deliveries`;
- billing: `subscriptions`, `telegram_star_payments`.

Ни одна вычисляемая метрика не сохраняется обратно и не изменяет пользовательские данные.

Все feature-агрегаты ограничены `[from, to)`: анкеты — по `onboarding_completed_at`, включённые
рутины — по `created_at`, запуски — по `wake_routine_runs.created_at`, AI — по `generated_at`.
