# Модель данных: Финальная Beta-версия MVP

## Дневная точка

Существующая производная сущность без новой таблицы:

- `localDate`: локальная календарная дата `YYYY-MM-DD`;
- `averageDelta`: среднее `postRating - baseline`;
- `evidenceCount`: число завершённых парных наблюдений;
- `sessionIds`: остаются в analytics contract для трассировки, но не передаются AI.

## Запрос отчёта

- `confirmEarly`: optional boolean, default `false`;
- при evidence count меньше 3 и `false` ответ получает `confirmation_required`;
- при `true` запрос допускается в обычный quota/cache pipeline.

## Безопасные сигналы отчёта

- `observedDays`: число дневных агрегатов;
- `recentDirection`: `improving | stable | declining | unknown`;
- `variability`: среднее абсолютное отклонение дневных приростов либо `null`;
- `riseSuccess`, `protocolEffects`, `factorEffects`: существующие safe metrics без evidence IDs.

## Персональный отчёт

Сохраняется в существующем cache record:

- `summary`: закономерности, устойчивость и сильные/слабые сигналы;
- `nextExperiment`: один контролируемый следующий эксперимент;
- `caveat`: размер и ограничения выборки без технической ошибки provider;
- `model`, `evidenceCount`, `generatedAt`, `evidenceFingerprint`: без изменений.

Новых lifecycle-состояний БД и миграций нет.
