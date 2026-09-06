# План реализации: Понятное пробуждение и персональные результаты

**Ветка**: `dev` | **Дата**: 7 сентября 2026 года | **Спецификация**: [spec.md](spec.md)

## Кратко

Устранить расхождение между прогрессом общего профиля и порогом факторных сравнений; показывать предварительный лидирующий протокол с первой полной сессии; обновлять локальные данные после post-rating; улучшить детерминированный подбор заданий под бюджет и недопущение повторов; компактно организовать статистику.

## Технический контекст

**Язык**: TypeScript strict, ESM, Node.js 22–24.
**Зависимости**: React 18/Vite 6, Fastify 5, TypeBox, Drizzle/PostgreSQL, Vitest, Playwright.
**Хранение**: существующая PostgreSQL schema; migration не требуется.
**Тесты**: domain unit, API contract, PostgreSQL integration, web component и mobile E2E.
**Платформы**: Telegram Mini App mobile web, Fastify API.
**Ограничения**: server-side identity/ownership/idempotency, AI получает только агрегаты; initial bundle ≤240 КиБ; пользовательские тексты на русском.

## Constitution Check

- Privacy: аналитика и AI остаются агрегированными, identity и ответы в логи не добавляются.
- Deterministic truth: готовность профиля, лидер и выбор протокола вычисляются server/domain code.
- Modular architecture: UI не получает формул; изменения остаются в domain, repositories, API и feature UI.
- Testability: обязательны domain, contract, component и E2E регрессии.
- Production authority: нет миграции, secrets, billing, webhook или deploy.

## Решения

1. Общий профиль использует все завершённые оценённые сессии; факторные сравнения сохраняют порог трёх пар.
2. `protocolEffects` доступен уже при `n=1`, но confidence остаётся `insufficient`; UI обозначает результат предварительным.
3. После post-rating web обновляет analytics/history; coach остаётся server-side recomputation.
4. Fallback AI — полезный ответ, а не техническая ошибка; внешний provider остаётся необязательным.
5. Domain selection получает предыдущий набор и выбирает иную допустимую последовательность; personalization дополняет короткий план разрешёнными активными шагами.
6. Daily trend остаётся AI-агрегатом, но убирается из пользовательской статистики.

## Project Structure

```text
packages/domain/src/analytics/profile.ts
packages/domain/src/experiments/learning.ts
packages/domain/src/personalization.ts
packages/domain/tests/{analytics,personalization}.test.ts
packages/db/src/repositories/sessions.ts
apps/api/tests/{contract,integration}/*.test.ts
apps/web/src/app/App.tsx
apps/web/src/features/{analytics,history,personalization}/
apps/web/tests/*.test.tsx
tests/e2e/wake-flow.spec.ts
docs/{api-contracts,architecture,product-roadmap}.md
```

## Риски и проверки

- Лидер не становится причинным выводом при `n<3`.
- Selection не выбирает запрещённое задание ради заполнения времени.
- History/routine сохраняют accessibility.
- Coach cache не обходит дневной лимит и не передаёт source observations provider.
