# Implementation Plan: Надёжный фундамент данных пробуждения

**Branch**: `dev` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-wake-data-foundation/spec.md`

## Summary

Преобразовать Figma-прототип в первый надёжный вертикальный срез Telegram Mini App: проверенный
вход через Telegram, серверное состояние wake-up сессии с восстановлением после перезапуска,
идемпотентные записи и воспроизводимая аналитика без ложной атрибуции смешанных протоколов.

Выбран модульный монолит в TypeScript: существующий React-клиент, отдельный HTTP API, независимый
доменный пакет и PostgreSQL как единственный источник истины. Клиент и API публикуются под одним
HTTPS origin. Производные показатели пересчитываются из неизменяемых наблюдений и кешируются
только вместе с версией метода.

## Technical Context

**Language/Version**: TypeScript 5.x; Node.js 22 LTS; modern evergreen JavaScript in Telegram WebView

**Primary Dependencies**: React 18, Vite 6, Tailwind CSS 4, Fastify 5, TypeBox/JSON Schema,
Drizzle ORM, Telegram Mini Apps JavaScript bridge

**Storage**: Managed PostgreSQL 17 as canonical storage; IndexedDB only for explicitly marked
unsynchronized client drafts

**Testing**: Vitest for domain and component tests; Fastify injection plus isolated PostgreSQL for
API integration tests; Playwright for the critical mobile journey

**Target Platform**: Telegram Mini Apps on current Android, iOS and desktop clients; stateless
Linux-hosted Node.js API; public same-origin HTTPS delivery

**Project Type**: TypeScript workspace containing a web application, HTTP API and shared packages

**Performance Goals**: usable home screen within 3 seconds for at least 95% of normal mobile opens;
accepted mutation acknowledged within 1 second at p95; profile analytics within 2 seconds at p95

**Constraints**: 99.5% monthly user-visible availability target; no loss of acknowledged writes;
one active session per user; idempotent mutations; no bot token or database credential in client;
all displayed analytics reproducible from source observations

**Scale/Scope**: MVP/pilot for up to 10,000 registered users, 1,000 daily active users and 100
concurrent active sessions; four user stories and the existing seven-screen wake-up journey

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle                        | Gate | Design evidence                                                                                                           |
| -------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| Reliable Wake-Up Continuity      | PASS | Server checkpoints, optimistic concurrency, idempotency, managed backups, same-origin deployment and explicit draft state |
| Truthful Experimentation         | PASS | Immutable observations, protocol-level attribution, matched comparisons, algorithm versions and sample-size labels        |
| Privacy and Security by Default  | PASS | Server-side Telegram validation, short-lived secure session, least-data model and deletion workflow                       |
| Modular Domain Architecture      | PASS | Domain, contracts, persistence, API and UI are separate workspace boundaries                                              |
| Testable and Observable Delivery | PASS | Unit, integration, contract and end-to-end gates plus structured privacy-safe telemetry                                   |

No constitution exceptions are required.

## Project Structure

### Documentation (this feature)

```text
specs/001-wake-data-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── web/
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   ├── shared/
│   │   └── telegram/
│   └── tests/
└── api/
    ├── src/
    │   ├── app/
    │   ├── auth/
    │   ├── sessions/
    │   ├── analytics/
    │   └── observability/
    └── tests/

packages/
├── domain/
│   ├── src/
│   │   ├── session/
│   │   ├── experiments/
│   │   └── analytics/
│   └── tests/
├── contracts/
│   └── src/
└── db/
    ├── src/
    └── migrations/

tests/
└── e2e/

infra/
└── README.md
```

**Structure Decision**: Use a pnpm workspace and modular monolith. The current root Vite
application moves to `apps/web` without a visual rewrite. `apps/api` owns transport and
authentication, `packages/domain` owns deterministic business rules, `packages/contracts`
owns shared request/response schemas, and `packages/db` owns persistence and migrations.
Infrastructure remains provider-neutral until a hosting provider is selected.

## Architecture

### Runtime flow

1. Telegram opens the public HTTPS Mini App.
2. The web client sends raw `Telegram.WebApp.initData` to the same-origin authentication route.
3. The API validates signature, bot audience and freshness before creating a short-lived,
   secure, HTTP-only application session.
4. The bootstrap route returns the user profile, active wake-up session and due follow-up.
5. Each accepted session transition includes an operation identifier and expected state version.
6. The API validates the transition in the domain package and commits the state plus immutable
   observation in one database transaction.
7. Analytics are computed from immutable observations and returned with method version,
   evidence count and confidence.

### Trust boundaries

- Telegram launch data is untrusted until validated by the API.
- Browser state is a cache and interaction draft, never the canonical record.
- Only the API role can read or mutate production tables.
- Domain operations receive verified user identity from the API boundary, not from request bodies.
- Logs contain internal correlation identifiers, not Telegram launch payloads or bot secrets.

### Persistence and concurrency

- `wake_sessions.version` provides optimistic concurrency.
- A database constraint enforces at most one active session per user.
- Every mutation has a user-scoped idempotency key and stored response fingerprint.
- Ratings, task observations and follow-ups are append-only source observations.
- Session status is a transactionally updated snapshot for efficient resume.
- Schema migrations are forward-only, reviewed and exercised against a production-like backup.

### Analytics model

- Session effect is `end_alertness - start_alertness` on the same 1-10 scale.
- Success rate is `UP follow-ups / answered follow-ups`; unanswered sessions are excluded.
- Exact protocol versions may receive descriptive aggregates after three completed observations.
- A category/action effect requires comparable within-user observations whose assigned protocols
  differ only by the evaluated factor. Mixed sessions alone never produce category causality.
- Confidence thresholds and selection rules are versioned domain policy, not UI constants.
- Initial thresholds: insufficient below 3 comparable observations, low at 3-5, medium at 6-11,
  high at 12 or more. These labels communicate evidence volume, not medical certainty.

## Deployment and Operations

- Serve `apps/web` from a global HTTPS edge/CDN and route `/api/*` to an always-available API
  under the same public origin.
- Run at least two API instances in production when the selected provider and budget allow it;
  the API remains stateless so instances can be replaced without session loss.
- Use a managed PostgreSQL service with automated backups, point-in-time recovery and encrypted
  connections.
- Maintain separate development, staging and production environments with independent databases,
  secrets and Telegram bot configuration.
- Deployment runs formatting, type checks, unit tests, integration tests, build and a staging
  smoke test before production promotion.
- Emit structured request, authentication, state-transition and database health telemetry with
  correlation IDs and no sensitive launch data.
- Rollback application releases independently from database rollback; migrations must preserve
  backward-compatible reads for at least one application version.

## Rollout

1. Create workspace boundaries and test tooling while keeping the prototype runnable.
2. Implement domain session transitions and analytics against fixtures.
3. Implement database schema, repositories and API contracts.
4. Add Telegram authentication and bootstrap.
5. Connect the existing UI to the API behind a development/demo mode boundary.
6. Validate resume, duplicate delivery and analytics scenarios in staging.
7. Enable a small pilot and monitor availability, save failures and follow-up completeness.

## Constitution Check After Design

The Phase 1 design preserves all five principles. The modular monolith is the simplest architecture
that provides a trusted server and durable multi-device storage. Immutable observations avoid a
full event-sourcing system while keeping analytics reproducible. Provider-neutral deployment
documentation avoids premature infrastructure lock-in. Gate remains **PASS**.

## Complexity Tracking

No constitution violations or exceptional complexity are introduced. Microservices, a message
broker, Redis and a separate analytics warehouse are intentionally deferred until measured scale
or delivery requirements justify them.
