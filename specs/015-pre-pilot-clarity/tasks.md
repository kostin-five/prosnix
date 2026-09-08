# Задачи: ясность перед пилотом

## Phase 1: Tests

- [x] T001 Добавить regression server count результата в web/component или mobile E2E
- [x] T002 Добавить regressions понятного профиля и session-delta графика
- [x] T003 Добавить Coach fallback/prompt regressions
- [x] T004 Добавить SVG accessibility/visual smoke для ходьбы и бренда

## Phase 2: Implementation

- [x] T005 Исправить результат сессии через свежий analytics profile в `apps/web/src/app/App.tsx`
- [x] T006 Переработать профиль и график в `apps/web/src/features/analytics/wake-profile-summary.tsx`
- [x] T007 Улучшить Coach presentation/fallback в `apps/web/src/app/App.tsx` и `apps/api/src/coach/`
- [x] T008 Исправить walk icon и Prosnix mark в существующих SVG-компонентах

## Phase 3: Validation

- [x] T009 Обновить architecture, roadmap, testing, release checklist и handoff
- [x] T010 Выполнить `pnpm verify:release`, mobile E2E и записать `validation.md`
- [x] T011 Подключить сохранённый брендовый баннер с мягкой маской и уточнить иконки ходьбы/разминки
- [x] T012 Заменить пользовательские emoji на единый набор контурных SVG-иконок
- [x] T014 Объединить рекомендации в одну карточку следующего эксперимента без дублирования в профиле и AI-отчёте
