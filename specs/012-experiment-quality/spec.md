# Спецификация: Качество экспериментов 0.3

**Создано**: 7 сентября 2026 года
**Статус**: Утверждено к реализации

## Пользовательские сценарии

### История 1 — Понять назначение (P1)

Пользователь перед стартом видит понятную причину следующего протокола, primary outcome и что именно сравнивается. Причина не раскрывает технические ключи и не обещает медицинский эффект.

### История 2 — Получить честный вывод (P1)

Статистика исключает несопоставимые сессии из factor comparison и объясняет confidence/evidence обычным языком. Последовательности заданий сравниваются как набор, не только как категория.

### История 3 — Дать feedback (P2)

После нескольких завершённых сессий пользователь один раз отвечает: полезен ли формат, раздражает ли он и намерен ли продолжать.

## Требования

- **FR-001**: Система MUST использовать разницу post-rating и baseline как primary outcome только для completed sessions с обеими оценками.
- **FR-002**: Factor/sequence comparison MUST исключать разные wake context и budget duration.
- **FR-003**: Назначение MUST отображать понятную server-provided reason, outcome и confidence без внутренних ID.
- **FR-004**: Analytics MUST вычислять sequence effects по точному упорядоченному набору task IDs, отображая `n` и confidence.
- **FR-005**: Система MUST version each assignment experiment deterministically and expose aggregated cohort breakdown by experiment version only to admin.
- **FR-006**: После пяти completed sessions система MUST запросить один идемпотентный feedback без блокировки wake flow.
- **FR-007**: Все новые формулы MUST иметь fixed fixtures и independent expected assertions.

## Критерии успеха

- **SC-001**: Любое назначение содержит понятную причину и первичный outcome.
- **SC-002**: Несопоставимые context/duration не участвуют в одном comparison group.
- **SC-003**: Сессия с пятью completed observations видит feedback не более одного раза.

## Границы

- Нет медицинских рекомендаций, новой инфраструктуры или production mutation.
- Отсутствие пилота делает результаты предварительными, а не причинными.
